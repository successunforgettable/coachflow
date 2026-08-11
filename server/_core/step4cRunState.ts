/**
 * step4cRunState.ts — the incremental run-state file, and the decision about whether teardown
 * has any Meta work to do at all.
 *
 * ── THE INCIDENT THIS FIXES ─────────────────────────────────────────────────────────────────
 *
 * The 2026-08-10 `--publish` attempt died at the landing-page publish step. It had already
 * created a service, an ICP, concepts, a Node 7 ad set and four rendered creatives — but the
 * state file was written only AFTER a successful publish, so `--teardown` had nothing to read
 * and refused. Worse, even given a hand-written state it ran the Meta phase FIRST, and that
 * phase correctly refuses a null campaign id, so it could never have reached the local half.
 * The rows had to be cleared by a one-off script written against ids copied out of a log.
 *
 * Two rules come out of that, and they are what this module encodes:
 *
 *   1. **An id is written the instant the artifact exists**, never at the end. This is the same
 *      lesson `publishLedger` encodes for Meta ids and `adCreativeTeardown` encodes for
 *      Cloudinary public_ids: a crash between creating a thing and recording it produces an
 *      orphan nobody can find later.
 *   2. **No campaign anywhere means there is nothing on Meta to delete** — so teardown skips
 *      that phase and goes straight to the local sweep, instead of throwing.
 *
 * ⚠️ Rule 2 is a SKIP, never a relaxation. `assertDeletableCampaign` is untouched: any non-null
 * campaign id still runs the full protected-id refusal. And a ledger and a state file that
 * DISAGREE about whether a campaign exists is not a skip case — it is a stop case, because the
 * cost of guessing wrong is a live campaign left on a real ad account.
 *
 * Pure: the file I/O is injected, so every branch is provable without a filesystem.
 */

export type Step4cPhase = "prepare" | "prepared" | "publish" | "published";

/**
 * Every id the run creates. All optional by design — the file is written from the first insert
 * onward and is expected to be read back half-filled after a crash.
 */
export type Step4cRunState = {
  phase: Step4cPhase;
  startedAt: string;
  updatedAt: string;
  /** Where the run happened. `--publish` refuses a state file from another machine. */
  host: string;
  label: string;

  // ── local artifacts, in creation order ──
  serviceId?: number;
  icpId?: number;
  conceptCount?: number;
  adSetId?: string;
  batchId?: string;
  landingPageId?: number;
  answeredTokens?: string[];
  landingPageSlug?: string;
  publicUrl?: string;
  /**
   * A coach-scoped answer (today only `[INSERT_BOOKING_URL]` → `users.bookingUrl`) writes OUTSIDE
   * the throwaway, onto the owner's own row. The value that was there BEFORE is recorded here so
   * teardown can put it back — deleting the throwaway would otherwise leave the owner's account
   * carrying a made-up booking link. Absent means no coach field was touched.
   */
  coachFieldsBefore?: Record<string, string | null>;

  // ── Meta, only ever written by --publish ──
  campaignName?: string;
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  publishedRowIds?: number[];
  ads?: Array<{
    adId: string;
    creativeId: string;
    headline: string;
    body: string;
    conceptId: number | null;
  }>;
};

export function emptyRunState(opts: { now: string; host: string; label: string }): Step4cRunState {
  return { phase: "prepare", startedAt: opts.now, updatedAt: opts.now, host: opts.host, label: opts.label };
}

/**
 * Fold one patch into the state. Shallow by intent: every field is a scalar or a whole array
 * that is replaced outright, so there is no merge rule to get subtly wrong at 2am.
 */
export function mergeRunState(
  prev: Step4cRunState,
  patch: Partial<Step4cRunState>,
  now: string,
): Step4cRunState {
  return { ...prev, ...patch, updatedAt: now };
}

export type MetaPhasePlan = {
  /** true → run the Meta teardown. false → nothing was ever created there. */
  run: boolean;
  campaignId: string | null;
  reason: string;
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Should teardown touch Meta?
 *
 * The LEDGER is the authority, because it is written synchronously at creation time and the
 * state file is written a beat later. The state's own campaign id is consulted only to detect
 * DISAGREEMENT.
 *
 * · neither has a campaign  → skip the Meta phase, run the local sweep
 * · both agree              → run it, on that id (the protected-id refusal still applies)
 * · they disagree           → THROW. One of the two is wrong, and the failure modes are not
 *                             symmetric: skipping when a campaign exists strands a real campaign
 *                             on a real ad account, and deleting an id the ledger never recorded
 *                             is deleting by guesswork. Neither is acceptable unattended.
 */
export function metaPhasePlan(params: {
  ledgerCampaignId: string | null | undefined;
  stateCampaignId: string | null | undefined;
}): MetaPhasePlan {
  const fromLedger = clean(params.ledgerCampaignId);
  const fromState = clean(params.stateCampaignId);

  if (!fromLedger && !fromState) {
    return {
      run: false,
      campaignId: null,
      reason:
        "no campaign id in the ledger or the state file — this run never reached Meta, so there is " +
        "nothing there to delete. Running the local sweep only.",
    };
  }
  if (fromLedger && fromState && fromLedger !== fromState) {
    throw new Error(
      `STOP — the ledger records campaign ${fromLedger} but the state file records ${fromState}. ` +
      `Teardown will not guess which is real: resolve it by hand before deleting anything.`,
    );
  }
  if (!fromLedger && fromState) {
    throw new Error(
      `STOP — the state file records campaign ${fromState} but the ledger has no campaign entry. ` +
      `The ledger is written at creation time, so this should be impossible; a campaign may exist ` +
      `on the ad account. Check it by id before running teardown again.`,
    );
  }
  return {
    run: true,
    campaignId: fromLedger,
    reason: `campaign ${fromLedger} recorded in the ledger — running the Meta teardown on that id.`,
  };
}

/**
 * `--publish` must refuse a state file it cannot trust. Three ways it can be untrustworthy, and
 * all three are cheap to check before anything irreversible happens:
 *
 *   · it was never prepared (a stale file from a half-run);
 *   · it was prepared on ANOTHER MACHINE — the state and the ledger live in /tmp, so a file that
 *     travelled without them describes artifacts this host cannot tear down;
 *   · it has already published — re-running would create a SECOND campaign while the first is
 *     still standing, and the ledger would then describe two.
 *
 * The "is the prepared service still in the database" check is deliberately NOT here: it needs a
 * query, so it lives in the script beside the connection.
 */
export function assertPublishable(state: Step4cRunState, host: string): void {
  if (state.phase === "publish" || state.phase === "published") {
    throw new Error(
      `REFUSING to publish: this state file is already at phase "${state.phase}" ` +
      `(campaign ${state.metaCampaignId ?? "unrecorded"}). Tear the previous run down first — ` +
      `publishing again would leave two campaigns standing and a ledger describing both.`,
    );
  }
  if (state.phase !== "prepared") {
    throw new Error(
      `REFUSING to publish: the state file is at phase "${state.phase}", not "prepared". The prepare ` +
      `phase did not finish, so the throwaway cascade is incomplete.`,
    );
  }
  if (state.host !== host) {
    throw new Error(
      `REFUSING to publish: this state was prepared on host "${state.host}" and you are on "${host}". ` +
      `The state and the ledger live in /tmp, so prepare and publish must run on the SAME machine — ` +
      `otherwise teardown cannot see the ids this run creates.`,
    );
  }
  for (const [field, value] of [
    ["serviceId", state.serviceId], ["icpId", state.icpId], ["adSetId", state.adSetId],
    ["batchId", state.batchId], ["landingPageId", state.landingPageId], ["publicUrl", state.publicUrl],
  ] as const) {
    if (value === undefined || value === null || value === "") {
      throw new Error(`REFUSING to publish: the prepared state has no ${field}. Re-run --prepare.`);
    }
  }
}
