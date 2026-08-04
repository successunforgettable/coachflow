/**
 * complianceTelemetry.ts — how often is the compliance gate actually catching things?
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The gate is a SAFETY NET. The real defence is upstream: the generator prompts carry
 * META_COMPLIANCE_RULES, the register standard, the banned-word list and the real-urgency rule,
 * all of which exist to make a violating draft not happen in the first place.
 *
 * Nothing measured whether that prevention works. The gate silently dropped variants and the only
 * trace was a console line nobody aggregated, so "how often does the model produce a
 * policy-violating ad?" had no answer — and without it there is no way to tell a prompt that needs
 * strengthening from a niche that is simply hard.
 *
 * A HIGH block rate means prevention is failing and the prompt needs work. A LOW block rate with
 * occasional spikes points at particular niches or angles. Either way the number is the input to
 * the next prompt change, which is why it is recorded per CLASS and per ANGLE rather than as a
 * single total.
 *
 * ── WHAT THIS DELIBERATELY IS NOT ───────────────────────────────────────────
 * Not a metrics backend. There is no StatsD/Prometheus/OTel in this repo and adding one for a
 * counter would be disproportionate. This keeps an in-process tally (readable by tests and by an
 * admin/debug caller) and emits ONE structured, greppable log line per generation, which is how
 * every other observability signal in this codebase is read back off Railway.
 *
 * The log prefix is deliberately fixed and unique so it can be filtered:
 *     railway logs | grep COMPLIANCE_GATE
 */

export type ComplianceGateOutcome = {
  /** Which generator produced the batch — "adCopy", "concepts", "script", "landingPage". */
  asset: string;
  /** Total variants the generator produced before the gate ran. */
  generated: number;
  /**
   * Variants that FAILED the gate on their FIRST pass. This is the prevention-failure number —
   * the one that says how often the prompt let a violating draft through. Recoveries do not
   * reduce it: a variant that was blocked and then regenerated cleanly still represents a draft
   * the prompt should not have produced.
   */
  blockedFirstPass: number;
  /** Variants recovered by regeneration after being blocked. */
  recovered: number;
  /** Variants that survived to the coach. */
  kept: number;
  /** Blocking class ids seen, e.g. negative_self_perception, invented_statistic. */
  classes: string[];
  /** Optional finer-grained key — the body angle, awareness stage, or niche. */
  labels?: string[];
};

type Tally = {
  generated: number;
  blockedFirstPass: number;
  recovered: number;
  kept: number;
  batches: number;
  byClass: Record<string, number>;
  byLabel: Record<string, number>;
};

const EMPTY = (): Tally => ({
  generated: 0, blockedFirstPass: 0, recovered: 0, kept: 0, batches: 0, byClass: {}, byLabel: {},
});

/**
 * Process-lifetime tallies, keyed by asset. Reset on deploy — this is a signal, not an audit log.
 * A plain object rather than a Map: this repo targets ES5, where iterating a Map trips TS2802.
 */
const tallies: Record<string, Tally> = Object.create(null);

/**
 * Record one generation batch's gate outcome. Safe to call unconditionally: it never throws, so a
 * telemetry bug can never take down a generation. That matters more than the number.
 */
export function recordComplianceGate(outcome: ComplianceGateOutcome): void {
  try {
    const key = outcome.asset || "unknown";
    const t = tallies[key] ?? EMPTY();
    t.generated += outcome.generated;
    t.blockedFirstPass += outcome.blockedFirstPass;
    t.recovered += outcome.recovered;
    t.kept += outcome.kept;
    t.batches += 1;
    for (const c of outcome.classes ?? []) t.byClass[c] = (t.byClass[c] ?? 0) + 1;
    for (const l of outcome.labels ?? []) t.byLabel[l] = (t.byLabel[l] ?? 0) + 1;
    tallies[key] = t;

    const rate = outcome.generated > 0 ? outcome.blockedFirstPass / outcome.generated : 0;
    const cumulative = t.generated > 0 ? t.blockedFirstPass / t.generated : 0;

    // ONE line, fixed prefix, key=value pairs — greppable and parseable without a log agent.
    console.log(
      `[COMPLIANCE_GATE] asset=${key} generated=${outcome.generated} ` +
      `blocked_first_pass=${outcome.blockedFirstPass} block_rate=${(rate * 100).toFixed(1)}% ` +
      `recovered=${outcome.recovered} kept=${outcome.kept} ` +
      `classes=[${Array.from(new Set(outcome.classes ?? [])).join(",")}] ` +
      `${outcome.labels?.length ? `labels=[${Array.from(new Set(outcome.labels)).join(",")}] ` : ""}` +
      `cumulative_block_rate=${(cumulative * 100).toFixed(1)}% cumulative_n=${t.generated}`,
    );
  } catch {
    /* telemetry must never break generation */
  }
}

/** Read the tally for one asset (or all). Used by tests and by any debug/admin surface. */
export function complianceGateStats(asset?: string): Record<string, Tally & { blockRate: number }> {
  const out: Record<string, Tally & { blockRate: number }> = {};
  for (const k of Object.keys(tallies)) {
    if (asset && k !== asset) continue;
    const t = tallies[k];
    out[k] = { ...t, blockRate: t.generated > 0 ? t.blockedFirstPass / t.generated : 0 };
  }
  return out;
}

/** Test-only reset. */
export function __resetComplianceGateStats(): void {
  for (const k of Object.keys(tallies)) delete tallies[k];
}
