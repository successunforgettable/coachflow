# 🟢 RESUME POINT — 2026-09-12, scoping complete, nothing built

**Written so a fresh terminal can resume from this exact point with no state lost.** Every number was measured at
write time. **Nothing is authorised to build.**

---

## 1. WHERE PRODUCTION IS

| | |
|---|---|
| deployed | **`9156875`, SUCCESS — untouched.** Railway deploys only `railway-build`; `origin/railway-build` is still `9156875` |
| `main` | `67517e3`, untouched |
| product code | **identical to `9156875`** — `git diff --name-only 9156875..HEAD` touches only `CHECKPOINT.md`, `CLAUDE.md`, `docs/` |
| database | post-wipe: **983 rows**, 3 accounts (1 dev · 117174 smoke · 1613 app-review login, held) |
| local tree | clean (0 tracked changes), 322 untracked (the deliberate screenshot set + this session's docs) |

## 2. HELD COMMITS — branch `docs/held-2026-09-12`, NOT pushed to a deploy branch, NOT merged

**`git log --oneline origin/railway-build..HEAD`** — all documentation, no product code. The branch exists on GitHub
purely as a backup of the held work; **`main` and `railway-build` have not received any of it.**

| commit | what |
|---|---|
| `deb8800` | the pre-launch dummy-data wipe write-up (`docs/handovers/WIPE_2026-09-12_PRELAUNCH_DUMMY_DATA.md`) |
| `7b4f265` | the Remotion AWS key scope-down write-up (`docs/handovers/REMOTION_KEY_SCOPEDOWN_2026-09-12.md`) |
| **`9c3f594`** | **the scoping write-up for queue items 7, 12, 13, 14, 15** (`docs/handovers/SCOPING_QUEUE_7_12_13_14_15_2026-09-12.md`) |
| + earlier | the 2026-09-11 documentation commits (entry-point fix, §0.6b/c/d, queue items 13–15, CLAUDE.md §14b) |

Restorable wipe export: `~/zap-wipe-export-2026-09-12/` — **keep until 2026-12-11** (90 days).

## 3. WHAT HAS AND HAS NOT HAPPENED

- ✅ **Scoping is COMPLETE** for queue items 7, 12, 13, 14, 15 — code paths re-verified against the deployed
  `9156875`, every verdict re-measured on the post-wipe database or the live site.
- 🔴 **NOTHING HAS BEEN BUILT. No fix has started. Investigation only.** No product file has been edited.
- 🔴 **Nothing is authorised to build yet.**

## 4. THE LABEL WAS WRONG — two families, not one "three-piece token fix"

| family | items | note |
|---|---|---|
| **Operator tokens** | **14** and **7** | 7 is **latent/unreachable** — no published page, and no screen can accept a landing-page rewrite (API only). It shares its root with 14 and is closed as a side effect of fixing 14 |
| **Unsupported claims in lead-magnet copy** | **12, 13, 15** | nothing to do with tokens. 13 is amplified by 12; 15 has two independent sources |

## 5. RECOMMENDED BUILD ORDER, once resumed

1. **Item 15** — first, because **three pages are LIVE right now** carrying unsupported speed/result claims:
   `bonus-42` (*"By Day 7, you will hold…"*), `bonus-43` (*"…send to a real person today"*), `bonus-33`
   (*"…complete sales page draft in 48 hours … complete today"*). Two sources: the free-asset offer prompt
   (`offerStandard.ts:371,382-389,433`; `offersGenerator.ts:97`) **and** the lead-magnet content generator
   (`leadMagnetContentGenerator.ts` ~`:700`), which predates `0c649c4` and also writes every bonus.
2. **Item 14** — the token fix; **closes item 7 as a side effect** (its third piece routes the rewrite republish
   through the real publisher).
3. **Item 13** — the magnet-name pick (kits select the `short` title, the template reads only `long` rows).
4. **Item 12** — **LAST. It needs its own database migration** (provenance on the stored topic) and migrations are
   never bundled with other work (architectural invariant 6).

## 6. 🔴 THE ONE OPEN DECISION — waiting on Arfeen, NOT yet answered

> **`bonus-42`, `bonus-43` and `bonus-33` are PROTECTED FIXTURES under the wipe's retention rules** — kept
> deliberately under retention test 1 (the pinned copy-grounding corpus, kit 225) and the services 272–277/285
> prohibition (kit 200). **Fixing item 15 means editing content on pages that were deliberately preserved.**
> **That crosses a retention rule set on purpose, so it needs Arfeen's explicit confirmation before any edit.**

## 7. THE NEXT SESSION STARTS HERE

1. **Get that one confirmation** (§6) — nothing on item 15 touches those pages until it is given.
2. **Then write the item-15 build prompt.** Not before.

Scoping detail for every item — defect, file/line, blast radius, scope:
**`docs/handovers/SCOPING_QUEUE_7_12_13_14_15_2026-09-12.md`**.

**Verify this block before trusting it:**
```
git log --oneline origin/railway-build..HEAD | wc -l     # held documentation commits
git diff --name-only 9156875..HEAD                       # must be CHECKPOINT.md / CLAUDE.md / docs/ only
git ls-remote origin refs/heads/railway-build             # must still be 9156875
npx tsc --noEmit 2>&1 | grep -c "error TS"               # baseline 34
```
