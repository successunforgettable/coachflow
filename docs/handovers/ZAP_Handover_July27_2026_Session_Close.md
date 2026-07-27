# ZAP Handover — July 27, 2026 — SESSION CLOSE

**`HEAD = origin/railway-build = d6ecc4a`.** (An earlier draft of this handover recorded `0656b67`, the
commit immediately below — the docs session-close commit `d6ecc4a` sits on top of it and is the real tip.)
ICP grounding is fully live. The anti-fabrication validator is
built but **reverted off the branch**, awaiting a widened false-positive sweep. A new authoritative compliance
reference is in the repo and drives the next sprint.

---

## 1. SHIPPED + LIVE this session (prod-verified)

### ICP grounding Phase 2 — migration `0096` (`groundingMeta`)
The three invented Class-A fields — `demographics`, `mediaConsumption`, `influencers` — are **removed from ICP
generation entirely**. Not hardened: removed. They fed no downstream generator (verified across all twelve),
they were fossils of interest-based Meta targeting that Andromeda superseded, and `influencers`/
`mediaConsumption` invented **named real people** and stated them as fact about a coach's audience.

Removing them **dissolved a structural bug** that no prompt wording could fix: the model kept hoisting the
seven demographic values out of their nested object (23 keys instead of 17), often enough that three retries
never recovered. With no nested object in the schema there is nothing to flatten — **8/8 clean live runs, mean
attempts 1.00**. Class-B vivid prose is intact. **DB columns kept dormant**, not dropped, for a future
ICP-powered tool.

**Three sibling fixes shipped alongside:** `icpAngleSuggestions` prompt duplication killed (**it had been
running with NO compliance filter**) · `regenerateSection` brought under the guards it fully bypassed ·
demographics camelCase/snake_case bug (the export rendered empty for every generated ICP).

### Laddered intake — `1fe41ff`
Opt-in sharpen offer placed **after the reveal card and before the kit** — the one window where nothing
references the ICP, so an in-place regenerate carries zero staleness. Four questions verbatim, each skippable;
`icps.sharpenWithLadder` does a full in-place UPDATE on the same row; answers persist in `groundingMeta` so a
later regenerate re-grounds rather than reverting. **Live decline-path verified on the running site** — no
pre-generation ladder, wow moment untouched. Bonus: the ICP created during that run came back with
`groundingMeta` populated, the first runtime proof the 0096 column is written.

## 2. NEW AUTHORITATIVE REFERENCE

**`docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` — read before ANY compliance or copy-register work.**

* **Three evidence tiers, which must not be collapsed.** Tier 1 (confirmed Meta policy) is the **only** tier
  that may become enforcement logic. Tier 2 (practitioner anecdote) informs judgement, **never a hard gate**.
  Tier 3 is ZAP's own implementation rules.
* **An explicit do-not-build list** of unverifiable agency claims that appear nowhere in Meta's docs — "MARS",
  "Account Health Score" 70/50/25, "Policy 4.3", the "Rule of 47", every cited percentage, and a "60-second
  review" that contradicts Meta's own "typically within 24 hours". Several research reports filed these under
  *"Verified Policy Realities"*. **Fake precision fails catastrophically rather than gracefully** — a threshold
  built on an unverifiable number breaks every campaign at once if the assumption was wrong.
* **Niche-aware strictness** keyed to `service.category`; the **crypto permission line** (the boundary is
  endorsement of buying/selling); and the **first-person register standard**.

## 3. HELD / NOT SHIPPED

**Anti-fabrication validator v1 — commit `6a89396`, REVERTED off the branch via `a912a2b`.**

It was pushed **by accident**: the docs checkpoint was authored on top of the held validator, so pushing the
docs carried it to origin and Railway began deploying it. Reverted rather than force-pushed, so history stays
intact and the work is recoverable.

* **Re-apply with `git revert a912a2b`** — *only* after the sweep clears its bar.
* **Bar: zero false positives on legitimate prose across VARIED coach shapes, AND 100% of planted fabrications
  still caught.** The ready-to-run sweep prompt is recorded verbatim in
  `ZAP_Handover_July27_2026_AntiFabrication_Validator_v1.md` §5.
* Why it is held: the validator **blocks**, and its false-positive surface is proven on only one beginner ICP
  plus unit cases. One class was already caught mid-verification (`"Every Monday"` read as a named third party;
  `"not 100% sure"` read as a statistic) which would have dead-ended every launch-stage coach.

**⚠️ Process lesson worth keeping:** a commit is not "held" once anything sits on top of it and gets pushed —
push moves the whole ancestry. Docs-only checkpoints must be authored from a branch position that carries no
held work, or the held work belongs on its own branch. Checking "no code in *this* commit" is not sufficient.

## 4. NEXT SPRINT — build order

**1. REGISTER CHANGE — first-person default** across adCopy, scripts and landing pages, with niche-aware
strictness by `service.category`.
*Rationale:* the banned thing is the **diagnostic address**, not emotional force — intensity is preserved and
only the aim changes. First person is **structurally outside** the personal-attributes rule (a claim about the
advertiser's own experience cannot assert knowledge of the viewer), and it avoids pushing beginners toward
inventing client testimonials.
**ICP generation is explicitly NOT reopened** — the ICP is internal, Meta never sees it; only generated
*output* register changes.

**2. WIDENED FALSE-POSITIVE SWEEP** on the held validator — deliberately **after** the register change, so it
sweeps against the new register rather than the old one.

**3. COMPLIANCE AXIS** — the six Tier-1 checks in §3.3 plus the crypto guard, shipped **with** the fabrication
validator as **one compliance layer**. Note check 5 (Special Ad Category trigger language) rests on **Tier-2
evidence → flag for coach confirmation, never auto-block**.

### 🔑 KEY INSIGHT to preserve
**The first-person register and the anti-fabrication validator solve the same beginner problem from two
directions.** A third-person case study requires a real client story — a new coach has no "Sarah" — so
third-person framing pushes them straight into inventing the exact Class-1 fabrication the validator blocks.
First person needs no client at all. They reinforce each other, which is why they ship as one layer rather
than as two unrelated passes.

## 5. Still open — Arfeen actions

* **🔴 SECURITY: rotate `zap-e2e-smoke@mailinator.com`'s password** and update `~/.zap-e2e-creds.env` before
  the next smoke run. CC leaked it into a transcript via a redaction-pattern miss — low severity
  (non-privileged test account, public inbox) but real.
* **Backlog:** cosmetic tidy-ups (stale "16 text section keys" comment at `icpPrompts.ts:204`;
  `ICP_JSON_SCHEMA.name` still `"ideal_customer_profile_17_tabs"`) · script filename feature (human-readable
  per-concept from awareness + hook + length) · blog generator + other ICP-powered tools · has-assets-path
  ladder (out of v1).

## 6. State

* Branch `railway-build`, **`HEAD = origin = d6ecc4a`** (verified 2026-07-27; `0656b67` is its parent).
  `main` untouched.
* Migration `0096` applied and verified on prod. No migration pending.
* Validator code **absent from the branch** (`fabricationValidator.ts`, `groundingCorpus.ts` gone; 0 publish-gate
  references in `meta.ts`); `6a89396` still reachable in history.
