# UNSCOPED ITEM: concept generation fails on retry, cut off at 8,192 tokens (logged 2026-09-14)

**Status: logged for later triage. NOT scoped, NOT authorised, NOT fixed.**

Found while proving the video-scripts build (`VIDEO_SCRIPTS_BUILD_2026-09-14.md` §4). That package calls the concept
generator but does not own it.

## 1. What was observed on production (2026-09-14, ICP 249 / kit 187 / service 272, smoke user 117174)

`ensureConceptsForIcp` → `generateConceptsForIcp`, run twice.

| run | what happened |
|---|---|
| 1 | Attempt 1 responded (in 4,427 / out 7,754 tokens, `stop_reason=tool_use`). The live reaper marked job `concepts-icp-249` **failed at 5 minutes** (*"Interrupted by server restart"*) while generation was still running. The harness then exited and killed it; that was a harness fault, since corrected. |
| 2 | Attempt 1 responded (in 4,427 / out 7,892, `tool_use`) and **was rejected by the concept gate**; which of structure, compliance or grounding was **not logged**. The retry appended the failure context (in 5,080) and was **cut off: `stop_reason=max_tokens`, out 8,192**. The job ended failed: *"Concept generation returned no concepts array"* (`server/conceptGenerator.ts:198`). |

**Result:** no concept set for ICP 249. `campaignConcepts` is unchanged, as the whole-database snapshots confirmed.

## 2. What the code shows (read, not changed)

- **The requested cap is never applied.** `invokeConcepts` passes `maxTokens: 4000` (`conceptGenerator.ts:192`). The
  Anthropic request body in `server/_core/llm.ts` hardcodes **`max_tokens: 8192`** (`:428`). `maxTokens` / `max_tokens`
  are declared on the params type (`:63-64`) and read nowhere.
  - So every `invokeLLM` caller gets 8,192, whatever it asks for (a separate path sets 32,768 at `:742`).
  - **For concepts the real ceiling is 8,192, and an 8-concept set on retry exceeds it.** The first attempt already
    used 7,754–7,892 tokens, and the retry prompt is longer.
- **A cut-off tool call carries no array**, so the whole set is lost. No partial set is kept, and nothing retries the
  truncation itself.
- **Which gate rejected attempt 1 is not recorded.** The failure is thrown from inside the retry call, before the
  `COMPLIANCE_GATE` telemetry line for concepts is written.

## 3. Shares the reaper / 5-minute mismatch — likely latent for other callers (TO CHECK, not established)

Concept generation measured **over 5 minutes** in one call (run 2). The reaper (`server/_core/index.ts`, every 60 s)
marks any `pending` job older than 5 minutes failed. `ensureConceptsForIcp`'s own header accepts that ("the rows still
land"), and the video-scripts screen was fixed to wait on rows rather than job status. **The other callers were not
checked for the same exposure.**

| caller | how it calls | on failure | to check |
|---|---|---|---|
| `routers/campaignKits.ts:183` (kit creation) | fire-and-forget; logs the outcome | nothing surfaces to the coach | a reaped-but-alive job reads `failed`; the next `ensureCampaignKit` / auto-select call **re-arms it** (`conceptGenerator.ts:643`). Can that start a **second concurrent generation**, both delete-then-insert per ICP? **Hypothesis, untested** |
| `adCopyGenerator.ts:356` (ad-copy entry) | fire-and-forget; `.catch(() => {})` | ad copy falls back to `conceptId = NULL`, a defined outcome that loses the concept axis for that run (`:739-747`) | how many ad sets are unstamped because the concept set never landed |
| `conceptScriptBatch.ts` (video scripts) | `generateForIcp` → `preparing_concepts` | screen waits on rows up to 12 min, then offers a retry | already handled |
| `routers/meta.ts:267-411` (concept assembly) | reads concepts | `conceptsSeen 0` | whether publish silently degrades with no concept set |

- **The re-arm keeps its original `created_at`** (`conceptGenerator.ts:643`), so a re-armed job is swept within 60 s.
  This is pre-existing.
- **Scale, measured 2026-09-14:** of 22 production kits, **only kit 225 has a concept set**. Why the other 21 have none
  (they predate the trigger, or generation failed) **is not measured**.

## 4. Triage questions (for scoping, not answers)

1. Should `invokeLLM` honour `maxTokens`, or should concepts request a larger ceiling? The first touches every caller.
2. On truncation (`stop_reason=max_tokens`): fail loudly, retry with a smaller set, or keep a partial?
3. Log the attempt-1 gate labels before the retry, so a rejection is diagnosable.
4. The reaper mismatch across all four callers above, including the re-arm `created_at`.
5. Whether kits 188–192 / 200 fail the same way. That needs an authorised production run.
