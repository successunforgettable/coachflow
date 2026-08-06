# CHECKPOINT — 2026-08-06 (post-deploy): the Andromeda image chapter is LIVE at `51bdd03`

**For a cold terminal with no memory of the session that produced this.** Read this file, then
`docs/handovers/STATE.md`. Everything below was verified in-session, not recalled.

⚠️ **`docs/handovers/STATE.md` is dated 2026-07-28 and knows nothing about the last six sessions.**
It has been wrong more than once. **Trace code and query the DB; do not trust handover prose.**

---

## 1. Where the repo is

| | |
|---|---|
| Branch | `railway-build` |
| HEAD | **`51bdd03`** |
| origin/railway-build | **`51bdd03`** — in sync |
| Unpushed | **0 commits** (plus whatever the current session is holding — see §11) |
| Deployed? | **YES.** Railway is green on this SHA; prod HTTP 200. |

⚠️ **THIS SECTION WAS WRONG FOR THE WHOLE OF 2026-08-06 AND IS THE REASON TO DISTRUST IT BY DEFAULT.**
It claimed HEAD `eb50e3a`, "origin UNMOVED", "Deployed? **NO**" — all three false once the six-commit
chapter shipped. A fresh session reads this file first, so a stale §1 is the most expensive stale
prose in the repo. **If you change what is deployed, this table is part of the change.**

**Push discipline is unchanged: the next push needs a fresh explicit "push" from Arfeen.** No prior
authorisation carries forward. Committing does NOT deploy; **pushing** deploys (~4s, no gate).

### The six commits that are live

| SHA | what |
|---|---|
| `e71f62f` | image engine Layers 1+2 — awareness × sub-type drives image selection |
| `eb50e3a` | stage-led engine, 4:5 feed, emitted-pixel text-safe band |
| `98cb623` | CHECKPOINT refresh |
| `e8c6ed3` | **visibility tier** — a repeated sub-type cedes its face rather than collapsing to one Entity ID |
| `5a42eaf` | deploy-gate fixture for `regenerateSingle` / `makeVertical` |
| `3d085ee` · `51bdd03` | id-scoped teardown rule · banked research reports |

Live in production, therefore: **stage-led shot concepts across five awareness stages** (Layer 1) ·
**sub-type styling** (Layer 2) · **4:5 feed with a per-canvas, emitted-pixel-measured text-safe band**
(Layer 3) · **the visibility tier** · compliance gate · awareness foundation · stage-aware copy.

Verified live by one labelled throwaway cascade (service 290), reconciled to baseline.

---

## 2. What `eb50e3a` actually changes

The awareness stage now drives the **shot concept** — subject, action, composition — and the sub-type
only **styles** it (lighting, backdrop, texture). Previously the style template fixed pose and
composition and the stage was appended afterwards, so it modified a decision already made.
`[AWARENESS-PLAYBOOK §3]` names that exact failure: *"If styling is allowed to lead, the ad risks
falling into 'default' poses… which trigger Entity ID clustering."*

Files: `routers/adCreatives.ts` · `_core/imageGeneration.ts` · `_core/compositeHeadline.ts` ·
`adCreativesGenerator.ts` · two test files · `scripts/measure-text-safe-zone.ts` · 3 research
reports + their README.

---

## 3. ✅ PROVEN — on live renders, zero DB writes, every run reconciled to 405

- **Layer 1 across all five awareness stages**, isolated: style and sub-type held constant, stage the
  only variable, with the styling half of every prompt asserted **byte-identical before any spend**.
  A same-prompt control render sets the diffusion-noise floor — noise changes *who and how*, the
  stage changes *what is happening*.
- **Fix 1 — Problem-Aware** carries friction in the **environment**, not the face. The first rebuild
  used "a hand at the temple", which the banked guardrails list verbatim as a prohibited distress
  trigger carrying *"a total retrieval penalty"*.
- **Fix 2 — Product-Aware** is an expert mid-demonstration addressing someone off-camera. It had been
  rendering as a head-on portrait, colliding with Most-Aware's PD-4 direct address. Guarded by test.
- **Fix 3 — verified ONLY on the composite.** Headline/body/CTA land on darkened defocused surface
  instead of across the work the scene was told to keep clear. ⚠️ **The raw render looked fine while
  the finished ad was broken — raw pixels cannot prove this.**
- **4:5 feed** with the reserved band keyed to **emitted pixels**, plus its guards (§4).
- **Still-life `screenshot` slot has pixels for the first time** — person-free, abstract text-free
  screen, clean plate held, and it stayed on gpt-image-1. **n=1.**

Proof images on disk (not committed — binary weight):
`docs/screenshots/run-2026-08-05-layer1-isolation/` · `run-2026-08-05-layer1-reprove/` ·
`run-2026-08-06-layer3-45/` · `run-2026-08-06-layer3-verify/`.
`run-2026-08-05-layer12-proof/` is the **pre-rebuild** "before" set.

---

## 4. The text-safe band — measured, per-canvas, and guarded

**Do not replace this with a constant.** It was measured by pushing a synthetic plate through the
real compositor at worst-case content (`scripts/measure-text-safe-zone.ts`).

| canvas | topmost glyph | reserved | wording |
|---|---|---|---|
| Flux 4:5 → **896×1088** | 0.6445 | 0.5048 | "the lower three-fifths" |
| gpt-image-1 4:5 → **1024×1280** | 0.6445 | 0.4955 | "the lower half" |
| 1:1 1024×1024 | 0.5693 | 0.5707 | "the lower three-fifths" |
| 9:16 1080×1920 | 0.5875 | 0.5515 | "the lower three-fifths" |

- **NOT ratio-invariant** — 4:5 and 9:16 are **5.7pp apart**. A scalar silently mis-reserves the
  9:16 path. Size-invariant *within* a ratio (1024×1280 vs 1440×1800 differ by 0.0001).
- `reservedFromBottom = 0.376 × W + padBottom(H)` — predicts 9:16 to within **two pixels**.
- **Keyed off EMITTED pixels, never the ratio string.** Flux answers "4:5" with **896×1088** (0.824);
  gpt-image-1 returns a true 1024×1280. Those straddle a band boundary, so the person slots were
  under-reserving by ~1pp — clearance by margin, not design. **Flux is deliberately NOT forced to
  exact 4:5**; 896×1088 is a valid Meta asset.
- **Crop direction settled on pixels**: `DEFAULT_CROP_DIRECTION = "bottom"` (keep the upper 1280).
  gpt-image-1 cannot emit 4:5, so it renders 1024×1536 and is cropped. The alternative was cramped
  and top-heavy. Both candidates are in `run-2026-08-06-layer3-45/08-crop-A` vs `08-crop-B`.
- `imageFormat` now records dimensions read off the rendered buffer, so a row cannot lie.

---

## 5. 🔴 OPEN — read this before claiming anything works

1. **THE WIRING GAP IS THE NEXT ROCK.** **Five of eight fan-out sites pass no stage** and render the
   pre-rebuild prompt. Only the cascade (`adCreativesGenerator.ts`) carries Layers 1–3.
   ⚠️ **Opening this forces the 4-vs-8 cardinality decision** — the tabloid deck is 4
   (`AD_VARIATIONS`), the concept batch is 8, and `adCreativesGenerator.ts:534` **throws** on a
   mismatch because a mismatch once caused a live outage (`5f3294d` → `304f6fd`). **Arfeen's call.**
2. **Esoteric and aspirational sub-types are unproven** with the new shot concepts. Only `grounded`
   has been rendered since the rebuild.
3. **flux@9:16 emission has never been measured.** It takes the conservative fallback.
   **Measure it before any stage-led vertical ships.**
4. **The editorial path has no Layers 1/2/3** and is untouched. A run routing editorial proves nothing.
5. **Four person stages (Unaware, Problem-Aware, Product-Aware, Most-Aware) were not re-rendered**
   after the band was rekeyed to emitted pixels. That change only **widened** clearance so it cannot
   have regressed them, but they are unswept — fold into the next full run.
6. **DEPLOY IS GATED on the shared paths.** `makeVertical` (9:16) and `regenerateSingle` share
   `generateAdImagePrompt` / `rendererForStyle` / `renderAdCreative`. **None of the five wizard
   procedures has an automated test** and they are historically error-prone (P6b). Exercise them
   before pushing. (`5a42eaf` added `sharedProcedureShapes.test.ts` for the first two — a shape
   fixture, NOT a render proof.)
7. **`makeVertical` builds its prompt with no aspectRatio**, so its reserved band comes from the
   static legacy clause while it renders 9:16 — the canvas whose true reserve is **0.5515**, furthest
   from the others. Inert today because it takes PATH A, but it is the same omission
   `regenerateSingle` had. **Not fixed — deliberately out of scope of the 08-06 canvas fix, which
   Arfeen scoped to two sites.**

---

## 6. ⚠️ EVERY GATE IS BLIND TO WHETHER A PICTURE IS GOOD

G4 checks only that a non-empty PNG reached disk. Nothing in the suite can see melodrama, legible
in-image text, an anatomical failure, or a subject buried under the headline.
**That judgement is Arfeen's and only Arfeen's. CC never self-certifies a visual result.**

---

## 7. Production data — verified 2026-08-06 (re-verified post-deploy by direct query)

- `adCreatives` = **405** (the baseline). `meta_published_ads` = **2**. `jobs` running = **0**.
- **All campaigns currently on ZAP are dummy/test data.** Nothing to preserve, migrate, or keep
  backward-compatible. This drops the urgency of the sites-4/6 stage-column migration — no real old
  campaign needs regeneration coherence.
- **The "never touch services 272–277 and 285" protection is RETIRED.** Those 29 creatives are
  confirmed pre-rebuild dummy/old-engine — 25 belong to the E2E smoke account (`117174`, created
  Jul 23–24), 4 are Arfeen's own Aug-3 old-engine set. **None is behind a live ad.** Deletable for a
  clean slate, but **only on Arfeen's explicit instruction, and any delete is id-scoped** (§10).
- **The two `meta_published_ads` rows are app-review dummies** — both `userId=1`, both **PAUSED**,
  both created **2026-05-12**, objective `OUTCOME_LEADS`, campaign name "Auto Campaign Kit". Not real
  campaigns. **No real Meta ad work has been done.**
- **Protected services untouched:** `272:5 273:5 275:5 276:5 277:5 285:4` — 29 creatives.
- **The 409-vs-405 drift is resolved.** It was NOT failed teardown: the previous proof's teardown was
  clean (0 surviving proof services, 0 orphan rows). Four rows (450–453, service 287, user 1) were a
  dummy demo campaign Arfeen made on 2026-08-05; he authorised their deletion and they are gone.
- ⚠️ **Service 287 still exists** and is NOT a shell — ~115 rows across 11 tables (60 hvcoTitles,
  14 placeholderValues, 11 heroMechanisms, 10 headlines, 9 adCopy, 6 campaignConcepts, plus ICP,
  offer, LP, email and WhatsApp). It now has **0 adCreatives** and is inert. Deleting the service row
  would cascade-delete the placeholderValues and orphan ~101 rows at `serviceId = NULL`. **Not done;
  needs its own decision.**

---

## 8. Gates

- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34** (CLAUDE.md §8 still says 35 — stale by one;
  34 re-confirmed 2026-08-06 post-deploy and again after the §11 canvas fix)
- **554 tests across 12 suites**, including `server/textSafeZoneCoupling.test.ts`
- CLAUDE.md §8 gate suites re-run 2026-08-06: `pipeline-fixes` + `complianceFilter` + `tokenCrypto`
  = **407 passed**. Image suites = **108 passed** across 6 files.
- ⚠️ `jobs` is **NOT a baseline metric** — 24h retention. Only `running = 0` has signal.

---

## 8b. 🔴 `regenerateSingle` — the diagnosis was TOO NARROW (corrected 2026-08-06)

It was recorded as *"screenshot rows regenerate on Flux (no style passed) — one-line fix"*. Traced,
the omission at **`routers/adCreatives.ts:1078`** is real but has **two live symptoms, not one**, and
a third that turned out to be a non-issue worth writing down so nobody re-derives it.

The canonical call is `adCreativesGenerator.ts:621` — `{ prompt, style, aspectRatio: FEED_ASPECT }`.
`regenerateSingle` passed **none of the three**.

| # | symptom | live? |
|---|---|---|
| 1 | **Emits 1:1 while the four sibling cards in the deck are 4:5** — a regenerated card is a different SHAPE. `generateImage` defaults `aspect_ratio` to `"1:1"` (`imageGeneration.ts:265`). | 🔴 **yes, and the most visible** |
| 2 | **Wrong model** — `rendererForStyle(undefined, …)` returns Flux, so a stored `screenshot` row loses gpt-image-1 (bake-off **6/6 vs 2/6** on niche relevance). | 🔴 yes |
| 3 | "Text-safe band computed for the wrong canvas" | ⚪ **NO — inert. See below.** |

⚠️ **SYMPTOM 3 IS NOT REAL TODAY, AND THE REASON MATTERS.** `generateAdImagePrompt` has two assembly
paths. **PATH A early-exits at `if (!stageAction) return stylePrompts[known]`** (`:719-720`) before
`zonePersonFor`/`zoneStillFor` are ever called. Both of these sites pass **no awareness stage**, so
they take PATH A and the `aspectRatio` argument is **never read** — the band wording comes from the
static `compositionPerson` / `compositionSetting` constants. Passing the ratio into the prompt
builder is therefore correct-and-inert; it goes live the moment these sites are wired to pass a stage
(the open fan-out gap, §5.1).

🔑 **AND MOVING TO 4:5 IMPROVES THE LEGACY WORDING RATHER THAN BREAKING IT** — measured against §4's
table, not assumed. The static clause says *"The lower half"*:

| canvas | true reserved fraction | static clause says | error |
|---|---|---|---|
| 1:1 1024×1024 (**old**) | 0.571 | "the lower half" (0.50) | **7.1pp UNDER-reserved** |
| 4:5 Flux 896×1088 (**new**) | 0.505 | "the lower half" | 0.5pp under |
| 4:5 gpt 1024×1280 (**new**) | 0.495 | "the lower half" | 0.5pp **over** — safe |

So these two paths were carrying a 7-point prompt/compositor disagreement at 1:1 and land within half
a point at 4:5. **This is a side benefit, not the reason for the fix, and it is still not a render
proof.**

**Also folded in, because leaving them out would create a NEW defect rather than avoid one:**
`imageFormat` is now measured off the rendered buffer at both sites (`regenerateSingle` previously
never updated it; `generateAdCreativesBatch` hardcoded `"1080x1080"`, which becomes a bigger lie once
the canvas moves). **`FEED_ASPECT` moved to `_core/adVariations.ts`** — it was a local `const` inside
`runAdCreativesGeneration`, which is precisely why two sibling loops never got it, and is the exact
duplication class that module's docblock exists to prevent.

---

## 8c. META — VERIFIED STATUS, scoped read-only 2026-08-06

**⚠️ THIS SUPERSEDES EVERY EARLIER NOTE TREATING META AS UNBUILT OR REVIEW-BLOCKED.** The handover
line *"the generate → publish-to-Meta → run path … is the real gate, and it's separate work"* was
wrong about the reason. **The integration is FULLY BUILT. The blocker is an expired user token.**

- ✅ **The publish path is real, end-to-end — not stubbed.** `meta.publishToMeta`
  (`routers/meta.ts:240`) makes four live Graph **v21.0** calls in sequence: `createCampaign` →
  `createAdSet` → `createAdCreative` → `createAd`, each a real `fetch` POST in `lib/metaAPI.ts`. Full
  CRUD plus status sync, alerts and pause/resume. **The client is wired:** `PushKitModal.tsx:291`
  calls it; `V2Settings.tsx` carries the connect flow.
- ✅ **App config is present on prod:** `META_APP_ID`, `META_APP_SECRET`, `VITE_APP_URL` all set on
  Railway service `coachflow` / environment `production`. `META_APP_SECRET` is read at
  `_core/metaOAuth.ts:37` and `routers/meta.ts:162`, nowhere else, and is not cached in a module
  variable — but `process.env` is fixed at process start, so a value change needs the restart Railway
  performs automatically on save.
- 🔴 **THE BLOCKER: the single stored Meta connection is EXPIRED.** `meta_access_tokens` holds
  **exactly one row** — connected **2026-05-11**, `tokenExpiresAt` **2026-07-10**, dead ~4 weeks.
  It DOES carry both `adAccountId` and `pageId`. `getMetaToken` (`metaAPI.ts:79`) returns `null` past
  expiry, so **every Graph call returns null and `publishToMeta` throws "Failed to create Meta
  campaign"**. **Reconnecting via Settings → Connect Meta is the WHOLE fix.**
- ✅ **`adSetId: "temp"` IS NOT A MISSING AD-SET ARCHITECTURE.** The real Meta ad-set id is stored
  correctly beside it as **`metaAdSetId`** (`meta.ts:419`), returned by the mutation and used by
  status sync. `adSetId` is the **internal CoachFlow** grouping nanoid (`schema.ts:1077`, matching
  `adCopy.adSetId`), so `"temp"` means only that the published row is not traceable back to the
  ad-copy set that produced it. **An internal traceability gap. It does NOT block running an ad**,
  and it is not evidence of an unbuilt ABO layer.
- ✅ **OWN-ACCOUNT PUBLISHING NEEDS NO APP REVIEW.** Meta grants an app's admins/developers/testers
  full permission on assets **they own** while the app is in Development Mode. Arfeen is the app
  admin and the ad account is his, so **App Review is NOT on the path to running his own ad** — and
  the two ads that published on 2026-05-12 are explained by this, rather than being evidence that
  review passed.
- 🔵 **Advanced Access review is a SEPARATE, UNSTARTED TRACK** — required only to onboard OTHER
  coaches (serving `ads_management` against ad accounts Arfeen does not own). Its status lives in
  Meta's App Dashboard and cannot be read from this repo; it needs Arfeen's login. **Do not conflate
  the two: nothing about that track blocks the first real ad.**
- 📌 `metaConnections` is a **dead table** — 0 rows, zero code references. Only `meta_access_tokens`
  is live. Do not read it.

**Plain answer to "to run one real ad, what is the blocker?"** — on Arfeen's own ad account:
**reconnect the expired token. That is the entire blocker.** No review, no config, no build. What
follows is a live-fire test of an existing path, not new work. Onboarding other coaches is the
separate Advanced Access track above.

📌 **Housekeeping, 2026-08-06:** `META_APP_SECRET` was exposed in a session transcript by a failed
redaction and is being rotated. Rotation point is the Railway variable named above; Railway redeploys
`coachflow` automatically on save. Rotation does not invalidate user tokens — but since the only
token is expired anyway, rotate and reconnect in one trip.

---

## 9. Traps specific to this work

- **The old test asserting the stage directive is APPENDED was DELETED.** It passed throughout while
  the stage never reached the picture — it was locking in the defect. Do not reinstate it.
- **`rendererForStyle` bounces unknown ratios to Flux.** Requesting a ratio gpt-image-1 cannot serve
  silently moves the still life off the model the bake-off chose (**6/6 vs 2/6** niche relevance).
- **The banked safe-zone figures describe META'S UI clearance**, not our own type. Never size our
  text band from them — measure it.
- **Research vs. code:** `[AWARENESS-PLAYBOOK §2]` asks for proof charts, calendars and labelled
  diagrams at various stages. **All are composed of text.** The object slot was retired over exactly
  this (48 renders, 2 leaked). Three departures are documented on `AWARENESS_DEPICTION`. PD-4 stands.
- **`[AWARENESS-PLAYBOOK §4]` contradicts its own §3** — its table makes Action a function of style.
  §3 + §2 govern.

---

## 10. Standing rules

- **⛔ NO PUSH WITHOUT ARFEEN'S EXPLICIT "push" IN THE IMMEDIATELY PRECEDING MESSAGE.**
- **Every prod write needs explicit "execute"/"go ahead" in the immediately preceding message.**
- **A LIVE RENDER IS THE ONLY PROOF OF A LIVE IMAGE PATH** — and for anything involving the text
  overlay, **the COMPOSITE is the only proof**. The raw render passed while the finished ad was broken.
- **Save proof images to disk BEFORE any teardown.** Teardown outranks the artifact read.
- **⚠️ TEARDOWN IS NOT DONE WHEN THE DB RECONCILES — IT MUST CLEAR CLOUDINARY TOO, AND THE ORDER IS
  FIXED: READ THE public_ids, THEN DELETE THE ROWS.** A DB delete never touches Cloudinary, and once
  the rows are gone **the URLs are unrecoverable from the database** — the images stay hosted
  forever. `server/lib/adCreativeTeardown.ts` exists precisely for this and does the two steps in the
  correct order; its docblock records the 30 orphans that accumulated across three runs on
  2026-07-29 before it was written.
  **This rule is here because CC broke it on 2026-08-06** — `scripts/regen-canvas-proof.ts` deleted
  its two rows directly, reported "405 ✅ RECONCILED", and left 4 orphans (raw + composited × 2). A
  green reconciliation line said the run was clean when it was not.
  **Recovery, if it happens again:** the ids can still be recovered from Cloudinary by listing —
  but use `cloudinary.search` sorted by `created_at desc`, **NOT `api.resources()`**, which caps at
  500 per page in no useful order and returned zero matches on the first attempt.
  `scripts/sweep-regen-canvas-orphans.ts` is the worked example (dry-run by default, pattern-scoped,
  refuses to delete unless the match count is exactly what was expected).
- **Do NOT write to protected services 272–277, or to service 285.**
- **⚠️ TEARDOWN IS ALWAYS ID-SCOPED, NEVER USER-SCOPED.** Smoke user **117174 OWNS the 25 protected
  creatives on services 272–277** (verified 2026-08-06). A teardown written as "delete this user's
  rows" would destroy them. Always `WHERE id IN (…)` plus a userId guard — never userId alone.
- **Write prose-heavy records with Write/Edit, never a bash heredoc** — backticks get shell-substituted.
- **⚠️ ONLY THE TABLOID DECK IS 4.** `EDITORIAL_VARIATIONS` stays 5.
- **~309 untracked earlier-session files deliberately left alone.** Never sweep them into a commit.
- **`railway run` block-buffers stdout.** Two runs today were invisible for 25 minutes while failing.
  Proof scripts log to a file with `appendFileSync` as well as stdout — keep that.
- **`MYSQLHOST`/`MYSQLPORT`/`MYSQLPASSWORD` are NOT set on the prod service.** Only `DATABASE_URL` is.
  Parse it (`python3 -c "urllib.parse.urlparse(os.environ['DATABASE_URL'])"`) and pass the parts to
  `mysql`; the CLAUDE.md §10 snippet using `$MYSQLHOST` fails with *"Empty value for 'port'"*.
- **The Drizzle key is not the table name.** `metaPublishedAds` in `schema.ts` is **`meta_published_ads`**
  in MySQL — querying the JS key errors with *"table doesn't exist"*. §9 of CLAUDE.md, in the wild.

---

## 11. ✅ SHIPPED — the two-site canvas + routing fix (2026-08-06), PROVEN LIVE

**Files:** `_core/adVariations.ts` (adds `FEED_ASPECT`) · `adCreativesGenerator.ts` (imports it, same
value, zero behaviour change) · `routers/adCreatives.ts` (the two call sites) ·
`sharedProcedureShapes.test.ts` (routing assertion **inverted** — it previously pinned the defect on
purpose, with a comment saying it was pinned "so the fix is a deliberate, visible change").

**Gates:** tsc **34**, six image suites **108 passed**, gate suites **407 passed**.

### Proven on prod, not on tests — `scripts/regen-canvas-proof.ts`

The harness calls **`appRouter.createCaller(ctx).adCreatives.regenerateSingle(...)`** — the real tRPC
procedure including its `setImmediate` background body. It does **not** re-implement the sequence; a
rebuilt sequence would prove the harness (STANDING RULE 2). Two labelled throwaway rows created and
regenerated, so **no pre-existing row was read-modify-written**.

| row | style | renderer | emitted | `imageFormat` written |
|---|---|---|---|---|
| 460 | `screenshot` | **gpt-image-1** (24.7s) | **1024×1280** | `1024x1280` ✅ |
| 461 | `person_shocked` | **flux-1.1-pro** | **896×1088** | `896x1088` ✅ |

Both rows were seeded with the old `1080x1080` lie and the fix overwrote each with true emitted
dimensions. **The person slot correctly STAYED on Flux** — a fix that moved every style would have
been a regression, not a fix. Images: `docs/screenshots/run-2026-08-06-regen-canvas/`.

**Reconciled:** `adCreatives` 405 → 407 → **405**, running jobs **0**, Cloudinary swept 4/4.

### ⚠️ Judged by Arfeen, and one thing is NOT fixed by this

The person card is clean — face entirely clear of the headline. **On the still life the headline
crosses the laptop screen and mug while the top ~45% is empty wall**: the legacy PATH A clause says
*"the main object sits high in the frame"* and the model did not obey. **This fix neither caused nor
cured that** — these paths were already on the legacy composition at 1:1, and there is no 1:1
before-shot from this path to compare against. Logged as a separate prompt-adherence issue on the
legacy still-life composition. Approved for ship by Arfeen on the pixels.
