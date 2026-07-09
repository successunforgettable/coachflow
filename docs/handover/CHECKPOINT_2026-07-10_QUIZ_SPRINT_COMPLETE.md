# CHECKPOINT 2026-07-10 — Quiz Sprint: COMPLETE & verified live on prod

**Status:** The interactive quiz / readiness scorecard is LIVE on production. Four atomic commits C1–C4, deployed and verified.

## Deploy state
- **HEAD = origin/railway-build = `34d20d9`**, in sync. Commits: `322767c` C1, `f3abaae` C2, `6287f19` C3, `34d20d9` C4 (fast-forward push onto `efca44c`; SHAs unchanged).
- **Served bundle moved `index-Bw9-BR6u.js` → `index-CQqIl7mU.js`** — this sprint had BOTH client and server changes.
- **Gates:** TS 35; **vitest 382 (new baseline** — was 367; C1 added 15 rubric-validator tests).

## How it was verified (client AND server — each proven the right way)
- **Client (bundle must move):** the new served bundle greps positive for the modal's own strings — "Your scorecard is ready", "Your quiz carries your logo, never ours", "The results they can get", "Publish update", "Review your scorecard".
- **Server (boot markers + real readback):** fresh boot markers (`Font validation OK`, `Stuck-job reaper`, `Server running`) + a live `POST /api/capture-lead` with `submissionData`+`resultBand`, read back from prod: `resultBand` + `submissionData` persisted, email ciphertext `enc:1:` decrypts — code the endpoint ignored before this deploy.
- **Live UI:** a Campaign Kit's Lead Magnet section shows "Review required — your scorecard isn't live yet" + "Review your scorecard →", which opens the deployed modal; an unpublished quiz surfaces as review_required (the gate).
- **Cleanup:** hvco 5682/5683/5684/5685 + kit 176 deleted (0 remaining), KV pages `/p/magnet-magnet-568{2,3,4,5}` → 404, C3 proof `capturedLeads` row deleted, no Cloudinary orphans (quizzes produce no PDF).

## What shipped
- **C1 — weighted readiness scorecard.** `QuizBody` redesigned: `questions:[{question, options:[{label, weight 0-3}]}]`, `scoring:{bands:[{name, minPercent, maxPercent, teaser, meaning, cta}]}`. Knowledge-quiz `answer` field removed. New positive-only Node 5 prompt + json_schema. `validateQuizBody` rubric validator (15 tests) rejects: <5 questions, <3 options, equal weights (per-question and global), band gaps/overlaps, non-0..100 coverage, missing teaser/meaning/cta.
- **C2 — interactive page + publisher one-page branch.** `renderQuizPage`: one self-contained KV page — client-side weighted scoring, one-question-per-screen, auto-advance single-select, ≥44px targets, 16px inputs, progress bar, back-nav, sessionStorage save-progress, gate-at-result (teaser → email → personalised band + per-band CTA + testimonial + logo). Publisher branches `format==="quiz"`: one page, `magnetHtmlUrl` = quiz page, no opt-in page, no PDF. Static formats untouched.
- **C3 — capture + persistence + retake + coach exports.** `/api/capture-lead` accepts+sanitises `submissionData` (json, ≤30 items / ≤20 KB, field-clamped) + `resultBand` (≤120); dedup `onDuplicateKeyUpdate` now overwrites both on retake (was URLs-only). `capturedLeads.list` exposes resultBand + decoded answers; `exportCsv` adds a resultBand column + one readable `question — answer` column per question (auto-sized to widest row). Honeypot / rate-limit / PII / consent unchanged.
- **C4 — review gate + review surface + shared logo resolver (A+B).** Shared `getCoachLogoUrl(userId)` (coachAssets, assetType='logo', per-user) wired into the publisher — brands quiz + static magnets; single source for the parked ad-image logo slot. Orchestration defers publish for a coach's first quiz (magnetHtmlUrl null → review_required); subsequent auto-publish. State derived (`coachHasApprovedQuiz` / `quizReviewState`) — no column, no migration. New `hvco.approveQuiz` (publishes, resolves logo; doubles as "Publish update") + `hvco.regenerateQuiz` (replaces assetBody, returns unpublished). `V2QuizReviewModal` read-only read-out (title/promise, collapsible questions, bands with score range + what they tell a prospect, branding block reusing `/api/upload-asset` + `saveCoachAsset`, Approve & publish / Regenerate / Close / Publish update). Kit Lead Magnet section shows Review required (blocking) / Review your quiz.

## Decision context
- **Weighted single-axis readiness scorecard, not a knowledge quiz.** The original forward-compat shape was wrong for a lead magnet and was redesigned in C1. **Archetype / multi-category tagging is a deliberate future variant, not v1.**
- **Email gates at the result** (teaser → email → full diagnosis).
- **No PDF for quizzes** — the personalised result page is the deliverable.
- **Zero-party answers stay in ZAP** (list + exportCsv). **GHL stays URL-only; `contacts.write` remains dormant.** Answers-into-GHL is a separate future decision.
- **First quiz per coach blocks until reviewed & approved** (derived state, no column); subsequent quizzes auto-publish with a non-blocking prompt. Rationale: auto-publishing an unread diagnostic instrument that carries the coach's name is risk transfer, not done-for-you.
- **Shared `getCoachLogoUrl`** brands the quiz and static magnets and is the single source for the parked ad-image logo slot.

## The one open gap (top priority)
- **Every `nextStep`/band CTA ("Book My Free Clarity Call") points at the magnet/quiz page itself, not the coach's real booking URL.** A prospect who's just been diagnosed clicks the CTA and goes nowhere — the most conspicuous hole in the funnel. **Booking-URL capture is the next sprint.** The interim `pageUrl` target was a deliberate placeholder throughout the delivery + quiz work.

## Queue (after booking-URL)
Brand-capture proper, quiz archetype/multi-category variant, ad-image logo slot (reads `getCoachLogoUrl`).

## Resume
Re-verify before trusting: HEAD == `34d20d9` == origin, bundle `CQqIl7mU` (client shipped), TS 35, vitest 382, prod 200, `/api/capture-lead` live. Next work = booking-URL capture (investigate-first). "Verified" = real readback/browser, never paper.
