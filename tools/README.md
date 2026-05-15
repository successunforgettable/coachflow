# `tools/` — ZAP operational + forensic tooling

This directory holds operational scripts that are NOT part of the production app runtime but are committed assets used by the team for audits, regression checks, and one-off operations.

Currently contains:
- `redteam-harness.ts` — fabrication-rate regression rig (red-team audit harness)
- `redteam-baseline/` — versioned forensic baselines from past audit runs

---

## `tools/redteam-harness.ts` — Red-Team Harness

### What it is

A scripted regression rig that programmatically generates 15 ZAP offers + 15 landing pages across an adversarial fixture matrix, then classifies the outputs against the fabrication-pattern catalog defined in `docs/redteam-failure-taxonomy-v1.md`.

The harness is the only way ZAP has to quantify fabrication frequency objectively. Subjective "this output looks bad" assertions don't survive across team members or time — `15/15 fabricated pricing` does.

### When to use it

| Scenario | Why |
|---|---|
| **Pre-launch verification** | Confirm no regression vs. the latest versioned baseline before opening warm beta or public beta |
| **Post-fix verification** | After modifying any generator prompt or validator, re-run to measure delta. This is the gate for "fix successful" claims. |
| **New generator integration** | Before adding a new generator (e.g., video script generation in a future sprint), extend the harness to cover it and capture a baseline. |
| **Catalog extension** | When adding a new fabrication pattern to the validator, run the harness to capture the new pattern's baseline rate. |
| **Major model swap** | If ZAP swaps Anthropic Sonnet 4.6 → 4.7 → 5.x or to a different LLM family, re-run to confirm no model-side regression in fabrication behavior. |

### When NOT to use it

| Scenario | Why not |
|---|---|
| As CI-on-every-commit | $40-80 per run × every commit is unaffordable. The harness is meant for milestone runs, not continuous integration. |
| As exploratory generation | If you just want to see what ZAP produces for a campaign type, use the V2 wizard. The harness produces test-only output that's auto-deleted. |
| To audit prompts unrelated to fabrication | The pattern catalog is fabrication-focused. Other quality dimensions (tone, accuracy, completeness) aren't measured. |

### Expected cost per run

- Wall clock: 30-60 minutes (sequential per-fixture to stay below Anthropic rate limits)
- LLM cost: $40-80 (115 calls × ~$0.30-$0.80 per call, depending on retry rate)
- DB impact: 15 services + 15 ICPs + 15 offers + 15 LPs + ~15 campaignKits temporarily persisted under `userId=1` with `__REDTEAM__` name prefix; auto-cleaned in `finally{}` block

### How to run

#### Full run (production env, real LLM cost)

```bash
cd /Users/arfeenkhan/zap-deploy
REDTEAM_EXECUTE=1 \
  REDTEAM_PROMPT_LOG_FILE=/tmp/redteam-prompts.jsonl \
  railway run --service coachflow --environment production -- \
  npx tsx tools/redteam-harness.ts
```

Without `REDTEAM_EXECUTE=1`, the harness refuses to run and prints a help banner. This guardrail prevents accidental cost.

#### Smoke run (no LLM cost — validates harness scaffolding)

```bash
cd /Users/arfeenkhan/zap-deploy
REDTEAM_EXECUTE=1 REDTEAM_SMOKE=1 \
  railway run --service coachflow --environment production -- \
  npx tsx tools/redteam-harness.ts
```

Runs setup → cleanup with zero generation. Verifies the harness can connect to the DB, insert fixtures, and clean them up. ~30 second runtime, $0 LLM cost.

### How to verify cleanup

After a run completes, confirm zero `__REDTEAM__`-prefixed rows remain:

```bash
railway run --environment production --service coachflow sh -c \
  'PASS=$(echo "$DATABASE_URL" | sed -E "s|^mysql://[^:]+:([^@]+)@.*|\1|"); 
   mysql -h trolley.proxy.rlwy.net -P 14382 -u root -p"$PASS" railway -e \
   "SELECT
      (SELECT COUNT(*) FROM services WHERE name LIKE '"'"'__REDTEAM__%'"'"') AS svc,
      (SELECT COUNT(*) FROM idealCustomerProfiles WHERE name LIKE '"'"'__REDTEAM__%'"'"') AS icp;"'
```

Both counts should be 0.

If interrupted (Ctrl+C or process killed), the `finally{}` cleanup may not run. Manual cleanup:

```sql
DELETE FROM campaignKits WHERE icpId IN (SELECT id FROM idealCustomerProfiles WHERE name LIKE '__REDTEAM__%');
DELETE FROM landingPages WHERE serviceId IN (SELECT id FROM services WHERE name LIKE '__REDTEAM__%');
DELETE FROM offers WHERE serviceId IN (SELECT id FROM services WHERE name LIKE '__REDTEAM__%');
DELETE FROM idealCustomerProfiles WHERE name LIKE '__REDTEAM__%';
DELETE FROM services WHERE name LIKE '__REDTEAM__%';
```

### What NOT to do

| Don't | Why |
|---|---|
| Don't run from CI / GitHub Actions / cron | Cost and DB pollution. Manual milestone runs only. |
| Don't modify fixture inputs in the harness directly | Fixture matrix is locked to v1 baseline for comparability. To extend, version the harness and the taxonomy doc together. |
| Don't bypass `REDTEAM_EXECUTE=1` | The gate exists to prevent accidental execution. Removing it is a footgun. |
| Don't archive results without versioning | Always copy to `tools/redteam-baseline/baseline-{YYYY-MM-DD}/` per the convention in `tools/redteam-baseline/README.md`. |
| Don't edit a frozen baseline | If you find an error in a past baseline, document the correction in a new version, not by mutating the old one. |
| Don't run against a different `userId` than 1 (Arfeen) | The harness hardcodes `TEST_USER_ID = 1` for cleanup safety. Cross-user runs would orphan rows for the wrong owner. |

### Cross-references

- Audit methodology: `docs/redteam-failure-taxonomy-v1.md`
- Current canonical baseline: `docs/redteam-audit-baseline-v1.md`
- Versioned raw artifacts: `tools/redteam-baseline/baseline-{YYYY-MM-DD}/`

---

## Future tools

When new operational scripts are added to this directory, document them in this README with the same structure: what / when to use / when NOT / cost / how / verify / what NOT to do / cross-refs.
