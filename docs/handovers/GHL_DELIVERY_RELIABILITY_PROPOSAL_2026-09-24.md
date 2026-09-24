# GHL DELIVERY RELIABILITY — INVESTIGATION + PROPOSAL (nothing built) — 2026-09-24

Items 1 and 5 of the build order in `END_TO_END_READINESS_2026-09-24.md`. Read-only: code at production `87596d7` (the
GHL files differ on the held branch only by the D6 push gate), git history across all refs, env-var presence on
production (values never printed), and GHL's official docs.

**The standard (Arfeen):** the coach is only told "success" when the values are confirmed present in GHL.

---

## A. GHL LOGIN RENEWAL

### A1. Where the token lives
- **Table** `ghl_access_tokens` (`drizzle/schema.ts:1242`): `userId`, `accessToken` and `refreshToken` (both AES-256-GCM,
  `enc:1:…`, `_core/tokenCrypto.ts`), `tokenExpiresAt`, `locationId`, `locationName`, `companyId`, `connectedAt`.
- **Written** — delete-then-insert of the whole row:
  - `server/_core/ghlOAuth.ts:92-159` — the Express OAuth callback. **The live path.**
  - `server/routers/ghl.ts:437-458` — a tRPC `exchangeCode` with the same logic. **No client caller** (grep) — dead.
- **Read** — each checks expiry on its own and none renews:
  - `ghl.ts:254-270` `getConnectionStatus` — expired ⇒ `connected: false` (Settings shows "Not connected").
  - `ghl.ts:303-314` `getWorkflowStatus` — expired ⇒ `installed: false`, i.e. the red **"Snapshot not applied"**. An
    expired login and an unapplied snapshot look identical to the coach.
  - `ghl.ts:491-494` `pushCampaign` — throws *"GHL token expired — please reconnect"* before calling GHL.
- **Production today** (read-only, earlier today): one row, user 1, access token expired **2026-07-10**, renewal key
  stored, row last written 2026-07-09.

### A2. Git history — has renewal ever existed? **No.**
A scan of **every commit on every ref** finds no refresh grant, ever. The two commits that touch `refresh_token`
(`23332e1` 2026-03-26, the first GHL integration; `a6211d9` 2026-05-13, the Express callback) only **store** it.
Nothing was written and reverted.

### A3. What GHL requires (official docs)
- `POST https://services.leadconnectorhq.com/oauth/token`, form-encoded: `client_id`, `client_secret`,
  `grant_type=refresh_token`, `refresh_token`, optional `user_type` (`Location`).
- Returns a new `access_token`, `expires_in` (~86,399 s ≈ 24 h), **and a new `refresh_token`**.
- **A renewal key is single-use**: using it invalidates it. Unused, it stays valid for **one year**.
- Concurrent calls with the same key inside **30 seconds** all receive the same new key (GHL changelog).
- Errors are not documented; standard OAuth returns `400 invalid_grant` for a used or expired key.
- Env on production: `GHL_CLIENT_ID` **set**, `GHL_CLIENT_SECRET` **set** — everything renewal needs is present.

📌 **Consequence:** the stored key from 2026-07-09 was never used, so by GHL's rule it should still be valid until about
2027-07-09 — renewal might restore the connection **without** Arfeen reconnecting. Unverified: only a real call would
tell, and that is a production write (it rotates the stored key).

### A4. Proposed design
1. **One helper** `getGhlAccess(userId)` (`server/_core/ghlToken.ts`), used by all three readers:
   - access token valid for more than 5 minutes → return it;
   - otherwise renew: POST as A3, then store the new access token, the **new** renewal key and the new expiry in **one
     update conditioned on the old key still being in the row** (compare-and-set), so two renewals racing past GHL's
     30-second window can never overwrite a live key with a dead one. The loser re-reads the row.
2. **Failures, by class — never silent:**
   | cause | what happens | what the coach sees |
   |---|---|---|
   | GHL rejects the key (`4xx`, e.g. `invalid_grant`), or no key stored | mark the connection **reconnect-required** | Settings: *"Your GoHighLevel connection has ended — reconnect GoHighLevel"* + the Connect button. Push: the same sentence, and the push does not start |
   | GHL down / network (`5xx`, timeout) | nothing marked | *"GoHighLevel didn't respond — try again in a minute."* |
   | a call returns `401` on a token we believed valid | renew once, retry once, then treat as the first row | as above |
3. **Marking reconnect-required** needs a place to record it: one nullable column (e.g. `reconnectRequiredAt`,
   `lastRenewalError`). That is a migration → isolated, its own commit (invariant 6). Deleting the row instead would
   lose the location and is not recommended.
4. **Workflow status stops lying the other way:** "can't check — connection problem" becomes its own state instead of
   the red "Snapshot not applied".
5. *(Optional, later)* a daily keep-alive that renews any connection whose key is older than ~11 months, so a coach who
   pushes rarely never hits the one-year limit.

**Tests, when built:** mocked GHL — success rotates both tokens; `invalid_grant` ⇒ reconnect-required; `5xx` ⇒
nothing changes; two concurrent renewals ⇒ one write; **negative control: a valid token makes no renewal call**.
**Live proof** needs a real renewal (a production write + an external call) — Arfeen's go-ahead. It could double as
the fix for the walkthrough's reconnect step.

---

## B. TRUTHFUL GHL PUSH RESULTS

### B1. Where "success" is decided — the server is honest, the client is not
- **Server** `ghl.ts:61-108` `upsertCustomValue`: LIST the location's values, then PUT (existing name) or POST (new).
  Returns `putRes.ok` / `postRes.ok` — **true only on an HTTP 2xx**. Each slot is combined honestly (`:528-963`;
  e.g. emails are true only if every subject, body, count and type value landed, `:597`). The mutation returns the
  flag map.
- **Client — this is where it lies:**
  - `PushKitModal.tsx:326-331` `fireGhl` returns **`ok: true` whenever the call returns**, whatever the flags say.
  - `:653` `allOk = results.every(r => r.ok)` → headline **"Pushed successfully"** even at **"0 of 9 slots pushed"** (9 slots, or 10 when a lead-magnet URL exists).
  - `:662` the **"Render your kit in GHL"** banner is keyed on the same `ok`, so it appears after a total failure too.
  - The per-slot ✓/✗ list underneath *is* truthful — but it sits under a success headline.
- **Also misleading:** a slot with **nothing to send** (e.g. no lead-magnet URL yet) stays `false` and shows as ✗, so
  "failed" and "nothing to send" are indistinguishable.
- **Silent paths:** every block's `try/catch` only `console.warn`s; if the LIST call fails the helper **falls through
  to a blind POST** (can create a duplicate value with the same name); orphan-cleanup DELETE failures return 0; a
  landing-page JSON parse error marks its slot false; **no record of any push is kept**.
- **Cost note:** the helper runs one LIST per value — about 30 GETs for one push.

### B2. What GHL actually returns on failure (on record)
| endpoint | response | source |
|---|---|---|
| `POST /locations/{id}/templates` | **401** `"The token is not authorized for this scope"` | `878a911` (2026-05-13) |
| `POST /locations/{id}/funnels` | **404** `"Cannot POST /locations/{id}/funnels"` | `878a911` |
| `GET /workflows/` with the expired token | **401** `"Invalid JWT"` | CHECKPOINT, ~2026-09-06 |
| `…/customValues` (the push itself) | **nothing on record — neither a failure nor a success** | — |

With an expired token the push never reaches GHL (`:494` throws first). Validation limits on Custom Value names or
lengths are undocumented and have never been observed.

### B3. Proposed design — success means "read back and confirmed"
1. **Server:**
   - Build the intended `name → value` map first (after placeholder resolution, as today).
   - **One LIST at the start.** If it fails, **stop** — no blind POSTs.
   - PUT or POST each value.
   - **One LIST at the end (read-back).** For every intended name: **confirmed** if present and equal (normalising only
     line endings and trailing whitespace); otherwise *rejected* (GHL's status + message), *missing on read-back*, or
     *present but different* (first differing position recorded).
   - Slots with no source asset are **nothing to send** — neither success nor failure.
   - The scope needed for the read-back, `locations/customValues.readonly`, is **already requested** (`ghl.ts:~396`)
     and already used by the helper's LIST. No new permission, no re-review.
   - Two LISTs per push instead of ~30.
2. **Client:**
   - **"Saved to GoHighLevel — N values confirmed"** only when every value that had something to send is confirmed.
   - Otherwise **"Not everything reached GoHighLevel"**, with the list of what didn't and why, and a Retry.
   - The "Render your kit in GHL" banner only after full confirmation. Nothing-to-send slots shown separately, never
     as ✗.
3. *(Optional)* a push record per kit (time, per-value status) so "what did we send, and when" has an answer — a
   migration, isolated.

**Tests, when built:** mocked GHL — all confirmed ⇒ success; one PUT 4xx ⇒ not-everything with that value named;
2xx but absent on read-back ⇒ not confirmed (**the negative control this whole item exists for**); value altered ⇒
"present but different"; start LIST fails ⇒ no writes at all.
**Live proof:** Arfeen's walkthrough (checklist step 20) is the first chance. With this built, ZAP's own result and
his check in GHL should agree.

---

## C. HELD-BRANCH DEPLOY READINESS — for Arfeen's later decision (nothing built from this)

`docs/held-2026-09-12` was **50 commits ahead** of production (`87596d7`) before this document's own commit (51 with it),
a clean fast-forward. **27 of the 50 touch documentation only** (measured: no file outside `docs/`, `CHECKPOINT.md`, `CLAUDE.md`). Pushing `railway-build` deploys all of it at once.

| workstream | commits | what it does in production | status |
|---|---|---|---|
| **Scenes-crash fix** | `231e655` (also alone on `fix/scenes-array-guard` = `94ae237`) | stops ~8% of video-script generations crashing with no retry | ✅ **finished, tested, safe.** Can ship alone from its own branch at any time |
| **Trial paywall + quota table + expiry gates** | `65af5e2` `8881b69` `493650b` `7f624fc` `4cfad01` | rationed trial on the Trail; Pro-only push; the table enforced for **every** tier; expired trials blocked on every AI path | ✅ **finished and tested** (browser-proven locally). ⚠️ **Changes what Pro sees:** Pro headlines go from 6/20 to **50**; Pro's offers / ad copy / ICPs / emails / WhatsApp **start counting** toward the table's caps (50 / 100). No trial user exists on production today, so the trial side has never run there. Before shipping: Arfeen OKs the Pro caps; one trial-account proof on production (a production write — needs his go-ahead) |
| **Compliance checker precision (sprint 8)** | `5c2d34e` `51bda65` | changes what the live compliance gate blocks — generation gates and the **Meta publish gate** (8 live importers of `complianceAxis.ts`) | 🟡 **finished and unit-tested, never measured live.** Ship deliberately, with a before/after on real copy — not bundled silently |
| **Grounding checker (F2 / F5), coach facts, checker latency, F5 label classes** | `799bd84` `41c817c` `d04a08c` `c609910` `23c563e` `60ec85f` (+ `60a14bf` harness) | **nothing** — no production caller (grep: `checkGrounding`, `buildCoachFacts` called only by tests and scripts). Migration 0111 (`coachFacts`) is already applied on production | ⚪ **inert** — safe to ship, does nothing until wired. D-g (F5's tier) and K9 (event-fact false positives) still open |
| **Video-script hook wording** | `0288828` `0787b33` `a717818` `d076ecb` (label-only check in `60ec85f`) | changes the live script-generation prompt | 🔴 **unfinished.** Measured today: first-pass over-budget equal to the untouched prompt (17/24), scripts produced 19/24 vs 22/24 (within noise). H2 not started. **Recommend it does not go live yet** — no measured gain, a possible small loss |
| **Dry-run / observation harnesses** | `82d1949` `54c7555` `dbfe389` `ae175bc` | `dryRun` / `onGate` parameters on the concept and script generators; the gate's `hookWords` observation | ⚪ **inert** by default (off unless a caller passes them) |

**If Arfeen wants the smallest safe deploy first:** the scenes fix from its own branch. **Everything else** waits on
his calls: the Pro caps, the compliance before/after, and the hook wording being held back (which would need the
branch split — the hook commits sit between others).

🔴 **While Arfeen's walkthrough may be in progress: no deploy of any of this.** Nothing on the held branch is needed for
it.

---

**Sources:** [HighLevel — OAuth 2.0](https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/index.html) ·
[HighLevel — Get Access Token](https://marketplace.gohighlevel.com/docs/ghl/oauth/get-access-token/) ·
[HighLevel changelog — refresh token handling for distributed systems](https://ideas.gohighlevel.com/changelog/marketplace-api-oauth-smarter-refresh-token-handling-for-distributed-systems)

---

## D. BUILD RECORD (2026-09-24, held branch — not deployed)

Both fixes built as proposed. **Migration `drizzle/0112_ghl_reconnect_required.sql` is written and NOT applied to
production.** 🔴 **Deploy order: 0112 first, then this code** — the schema names the two new columns, so every read of
`ghl_access_tokens` would fail with "Unknown column" if the code went live first. No real renewal was attempted with
the stored July key; no real GHL call was made anywhere.

- **Renewal:** `server/_core/ghlToken.ts` `getGhlAccess` — the only way to get a token; used by Settings status,
  the snapshot check and the push (plus a forced renewal on a 401). Compare-and-set save; in-process sharing; a
  rejected key marks `reconnectRequiredAt`; GHL down marks nothing. The unused `exchangeCode` (no caller anywhere)
  is removed.
- **States:** connection `connected · not_connected · reconnect_required · unreachable`; snapshot check adds
  `unreachable` / `reconnect_required` as their own states — "Can't check the connection right now", never
  "Snapshot not applied". The OAuth callback clears the cached snapshot status on reconnect.
- **Push:** `GhlPushSession` in `routers/ghl.ts` — one list at the start (the push stops if it fails: no blind
  POSTs), every write recorded with GHL's own status and message, one list at the end, each value confirmed /
  rejected / missing / changed, empty slots "nothing to send". The coach sees "Saved to GoHighLevel — N values
  confirmed" only when every value that had something to send is confirmed; otherwise what didn't make it, why,
  and Retry. The "Render your kit in GHL" banner only after a confirmed push. "Push to both" now pushes only the
  platforms that are ready (it used to fire GHL even when GHL's own button was disabled).

**Browser check** (local build, throwaway local MySQL with production's schema only + 0112 applied LOCALLY, and a
fake GHL answering every GHL request inside the local server — 48 requests, all answered by the fake):
`docs/screenshots/ghl-reliability/` — 01 confirmed (9 values, banner) · 02 not everything (Offer *changed*, Email
*rejected — "GoHighLevel said 422: The value for ZAP Email 2 Body is too long"*, Retry, no banner; Retry then
confirmed) · 03 push window, reconnect required · 04 Settings, reconnect required · 05 Settings, GHL down ·
06 push window, GHL down (row NOT marked afterwards).
