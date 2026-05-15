# Red-Team Baseline Artifacts

This directory archives versioned forensic baselines from ZAP's red-team audits. Each baseline subdirectory is the canonical raw evidence for one audit run.

## Versioning convention

```
tools/redteam-baseline/
  baseline-2026-05-13/   ← v1 baseline (Pre-Phase-1 state)
  baseline-2026-MM-DD/   ← v2, v3, ... (post-fix verifications + extensions)
  README.md              (this file)
```

Each baseline directory is FROZEN after creation. Files inside are not modified after the audit run produces them.

## What's in a baseline directory

Every baseline produced by `tools/redteam-harness.ts` writes four artifacts:

| File | Format | Contents | Typical size |
|---|---|---|---|
| `results.json` | JSON | Full structured findings + per-fixture record + per-category counts + classification breakdown + summary stats | ~500-800 KB |
| `raw-outputs.jsonl` | JSONL (append-only) | Per-fixture full generated content (offer 3 angles + LP 4 angles) — preserves verbatim LLM output for every fixture | ~400-700 KB |
| `prompts.jsonl` | JSONL (append-only) | Every LLM invocation's exact prompt sent to Anthropic — system message + user message + tool config + output schema | ~1.5-3 MB |
| `stdout.log` | Text | Full execution narrative including in-flight validator firing log lines + per-fixture timing | ~5-20 KB |

## How a baseline is produced

```bash
cd /Users/arfeenkhan/zap-deploy
REDTEAM_EXECUTE=1 \
  REDTEAM_PROMPT_LOG_FILE=/tmp/redteam-prompts.jsonl \
  railway run --service coachflow --environment production -- \
  npx tsx tools/redteam-harness.ts

# After completion, copy artifacts to a new baseline directory:
DATE=$(date +%Y-%m-%d)
mkdir -p tools/redteam-baseline/baseline-${DATE}/
cp /tmp/redteam-results.json       tools/redteam-baseline/baseline-${DATE}/results.json
cp /tmp/redteam-raw-outputs.jsonl  tools/redteam-baseline/baseline-${DATE}/raw-outputs.jsonl
cp /tmp/redteam-prompts.jsonl      tools/redteam-baseline/baseline-${DATE}/prompts.jsonl
cp /tmp/redteam-stdout.log         tools/redteam-baseline/baseline-${DATE}/stdout.log
```

## Cost + runtime per baseline

| Item | Typical value |
|---|---|
| Wall clock | 30-60 minutes |
| LLM calls | ~115 (Anthropic Sonnet 4.6) |
| LLM cost | $40-80 |
| DB impact | 15 temp services + 15 ICPs + 15 offers + 15 LPs + ~15 campaignKits (auto-cleaned in `finally{}`) |
| Disk impact | ~3-4 MB per archived baseline directory |

## Why archive prompts?

The `prompts.jsonl` artifact captures the EXACT prompts the LLM saw at the time of the audit. Once a generator's prompt is modified (e.g., Phase 1 offer hardening), the old prompt text is only preserved in this archive. Without it, "what did the LLM see before we changed it" becomes irrecoverable, and post-fix comparisons lose forensic depth.

## Why archive raw outputs?

The `raw-outputs.jsonl` artifact is the EVIDENCE for every finding in the matching baseline doc. Any claim like "fixture 07 had `£25,000` in its offer pricing" is verifiable by inspecting this file. Without it, findings become unfalsifiable assertions.

## Future baselines

When Phase 1 fixes land, a new baseline (v2) will be produced and archived alongside v1. The two baselines together quantify the fix's effectiveness:

| Category | v1 rate | v2 rate (expected) | Delta |
|---|---|---|---|
| `fabricated_pricing_currency_amount` | 15/15 | ≤1/15 | -93% |
| `fabricated_bonus_value` | 15/15 | ≤1/15 | -93% |
| ... | ... | ... | ... |

See `docs/redteam-failure-taxonomy-v1.md` §3 for the full pass criteria contract.

## Cross-references

- Audit document: `docs/redteam-audit-baseline-v1.md`
- Methodology: `docs/redteam-failure-taxonomy-v1.md`
- Harness: `tools/redteam-harness.ts`
- Tools README: `tools/README.md`
