/**
 * metaSafety.ts — the constants and refusals that stand between step 4c and a real ad account.
 *
 * ⚠️ WHY THIS IS ITS OWN MODULE. `act_1254349025145319` ("KS 1") is not a sandbox: it is ACTIVE,
 * denominated in **AED**, and carries roughly **AED 1,168,324** of lifetime spend across ~200
 * real campaigns (read-only inventory, 2026-08-10). Every value and every refusal below was
 * MEASURED against that account rather than assumed, and each exists because the alternative is
 * a mistake nobody can undo from a transcript.
 *
 * Pure and dependency-free on purpose, so the guards can be exercised without Meta.
 */

/** Thrown instead of deleting anything that is not this run's own object. */
export class ProtectedCampaignError extends Error {
  constructor(public readonly campaignId: string, reason: string) {
    super(`REFUSING to delete campaign ${campaignId}: ${reason}`);
    this.name = "ProtectedCampaignError";
  }
}

/**
 * The two campaigns this product published on 2026-05-12 and still tracks in
 * `meta_published_ads`. App-review dummies, both PAUSED — but they are the baseline of 2 that
 * teardown reconciles to, so they must survive.
 */
export const TRACKED_CAMPAIGN_IDS = [
  "120246733556760626",
  "120246734574720626",
] as const;

/**
 * 🔵 THE THREE PRE-EXISTING ORPHANS. The account shows FIVE campaigns named exactly
 * "Auto Campaign Kit" against TWO tracked rows; these are the other three, identified by id on
 * 2026-08-10. Most plausibly publishes that got past `createCampaign` and failed later.
 *
 * ⚠️ THEY ARE NOT 4c's TO CLEAN UP. 4c's only obligation is to not add a sixth. Tidying them is
 * a separate parked question with its own decision, and a run that quietly removed them would
 * destroy the evidence that question rests on.
 */
export const KNOWN_ORPHAN_CAMPAIGN_IDS = [
  "120246733286970626",
  "120246731977370626",
  "120246731522130626",
] as const;

/** Every id 4c must refuse to delete, whatever else it is told. */
export const PROTECTED_CAMPAIGN_IDS: readonly string[] = [
  ...TRACKED_CAMPAIGN_IDS,
  ...KNOWN_ORPHAN_CAMPAIGN_IDS,
];

/** The name the five protected campaigns share. 4c must never publish under it. */
export const ORPHAN_CAMPAIGN_NAME = "Auto Campaign Kit";

/** How many campaigns carry that name today. Teardown re-checks this is UNCHANGED. */
export const EXPECTED_AUTO_KIT_COUNT = 5;

/**
 * ── THE BUDGET FLOOR ────────────────────────────────────────────────────────────────────────
 *
 * `createAdSet` sends `Math.round(dailyBudget * 100)` MINOR UNITS, and this account bills in
 * AED. Our own validator is `z.number().min(1)`, which silently assumes USD:
 *
 *   dailyBudget 1  → 100 minor units = AED 1.00  → REJECTED ("must be more than AED3.00")
 *   dailyBudget 20 → 2000 minor units = AED 20.00 → ACCEPTED (proven on the step-1 publish)
 *
 * ⚠️ Meta does NOT expose a queryable per-currency floor — `min_daily_budget_low_freq` does not
 * exist on the ad account in v21 (it answers `(#100) Tried accessing nonexisting field`). So
 * the floor below is the MEASURED rejection on this account, not a documented number.
 *
 * ⚠️ ZERO IS NOT AN OPTION. `createAdSet` omits the budget field entirely when the value is
 * falsy, and Meta rejects an ad set carrying neither a daily nor a lifetime budget when the
 * campaign has no CBO. The honest minimum is a real number above the floor.
 *
 * The pinned value is 20 because it is PROVEN accepted here. A budget is a ceiling, not a
 * charge: with every object PAUSED nothing delivers and nothing is spent, so the proven value
 * costs nothing, while probing the true floor risks a rejected ad set part-way through a live
 * run.
 */
export const PINNED_DAILY_BUDGET_AED = 20;

/** Below this the harness refuses rather than letting Meta reject it mid-run. */
export const MIN_DAILY_BUDGET_AED = 4;

/**
 * ── PER-CURRENCY FLOORS ─────────────────────────────────────────────────────────────────────
 *
 * ONE ENTRY PER CURRENCY WE HAVE ACTUALLY MEASURED. Meta does not expose a queryable floor
 * (`min_daily_budget_low_freq` answers `(#100) Tried accessing nonexisting field` on v21), so
 * every number here is a MEASURED rejection on a real account, never a documented one.
 *
 * 🔑 ADDING A CURRENCY IS ONE LINE. Measure the rejection, add the entry, cite where it came
 * from. Do NOT populate this speculatively from Meta's help-centre tables — an unverified floor
 * that is too high silently refuses budgets Meta would have accepted, and this map is consulted
 * on a COACH-FACING path where that reads as the product being broken.
 */
export const MEASURED_DAILY_BUDGET_FLOORS: Readonly<Record<string, number>> = {
  // MEASURED on act_1254349025145319: `createAdSet` rejected 1 with "must be more than AED3.00".
  AED: MIN_DAILY_BUDGET_AED,
};

/**
 * The floor applied when the account's currency is KNOWN but we have never measured it.
 *
 * ⚠️ DELIBERATELY PERMISSIVE, AND THAT IS THE WHOLE POINT. We have no measurement for this
 * currency, so any number we pick above 1 would be INVENTED — and an invented floor that sits
 * above Meta's real one silently refuses budgets Meta would have happily accepted. On a
 * coach-facing path that does not read as a safety feature; it reads as the product being broken,
 * and the coach has no way to tell which of the two it is.
 *
 * So for an unmeasured currency **META REMAINS THE REAL GATE**. This catches only obviously-broken
 * sub-1 values — a zero, a negative, a stray decimal — where no currency on earth accepts the
 * number and we can say so without guessing. Everything above that goes to Meta, which knows its
 * own floor and will say so.
 *
 * 🔑 The way to make this stricter is NOT to raise this number. It is to MEASURE the currency and
 * add one line to MEASURED_DAILY_BUDGET_FLOORS, at which point the coach gets a real threshold
 * backed by a real rejection. Raising this constant instead would spread a guess across every
 * currency at once.
 */
export const UNMEASURED_CURRENCY_FLOOR = 1;

export type BudgetFloorVerdict = { ok: true } | { ok: false; message: string };

/**
 * THE ONE PLACE A DAILY-BUDGET FLOOR IS DECIDED. `assertDailyBudgetFloor` (the harness entry
 * point) delegates here, so the AED threshold exists exactly once.
 *
 * `currency` null/unknown means the lookup did not resolve — see the caller. That case is
 * DELIBERATELY PERMISSIVE: it returns ok and logs nothing here, because refusing a publish on a
 * transient Graph hiccup would be a regression against today's behaviour, where no floor is
 * enforced at all. A floor we cannot justify is worse than the floor we do not yet have.
 */
export function checkDailyBudgetFloor(
  dailyBudget: number,
  currency: string | null | undefined,
): BudgetFloorVerdict {
  if (!Number.isFinite(dailyBudget)) {
    return { ok: false, message: `daily budget must be a finite number, got ${dailyBudget}` };
  }
  const code = (currency ?? "").trim().toUpperCase();
  if (!code) return { ok: true };                       // unknown currency → do not invent a floor

  const measured = MEASURED_DAILY_BUDGET_FLOORS[code];
  const floor = measured ?? UNMEASURED_CURRENCY_FLOOR;
  if (dailyBudget >= floor) return { ok: true };

  if (code === "AED") {
    // Wording preserved verbatim — the harness tests pin this string.
    return { ok: false, message:
      `REFUSING a daily budget of ${dailyBudget}: this ad account bills in AED and Meta rejects ` +
      `anything at or below AED 3.00 ("must be more than AED3.00", measured on this account). ` +
      `The harness pins ${PINNED_DAILY_BUDGET_AED}. Our own z.number().min(1) is currency-unaware ` +
      `and must not be relied on here.` };
  }
  if (measured !== undefined) {
    return { ok: false, message:
      `A daily budget of ${dailyBudget} is below the measured minimum for this account. ` +
      `This ad account bills in ${code}, where the minimum daily budget is ${floor} ${code}. ` +
      `Enter ${floor} ${code} or more.` };
  }
  return { ok: false, message:
    `A daily budget of ${dailyBudget} is not a usable amount. This ad account bills in ${code}, ` +
    `and every currency requires at least ${floor} ${code} per day. Enter ${floor} ${code} or more. ` +
    `(Meta also enforces its own per-currency minimum, which it does not publish through the API ` +
    `and which we have not measured for ${code} — so a low-but-valid number may still be rejected ` +
    `by Meta with its own message.)` };
}

export function assertDailyBudgetFloor(dailyBudget: number): void {
  // The 4c harness runs against the AED account. Delegates so the threshold lives in ONE place.
  const v = checkDailyBudgetFloor(dailyBudget, "AED");
  if (!v.ok) throw new Error(v.message);
}

/**
 * The throwaway campaign name. `ZZ-` matches the convention already used for throwaway local
 * rows, and the timestamp makes two runs distinguishable.
 *
 * ⚠️ IT MUST NEVER BE "Auto Campaign Kit". Publishing under that name would make this run's
 * campaign indistinguishable at a glance from the three orphans, and would put them at risk
 * from any future cleanup that went by name.
 */
export function campaignLabelFor(nowIso: string): string {
  const stamp = nowIso.replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  const name = `ZZ-4C-MULTIAD-${stamp}`;
  assertSafeCampaignName(name);
  return name;
}

export function assertSafeCampaignName(name: string): void {
  if (name.trim().toLowerCase() === ORPHAN_CAMPAIGN_NAME.toLowerCase()) {
    throw new Error(
      `REFUSING to publish under the name "${name}": it is the name the five protected campaigns ` +
      `share, and reusing it would make this run's campaign indistinguishable from the orphans.`,
    );
  }
  if (!name.startsWith("ZZ-")) {
    throw new Error(`REFUSING to publish under "${name}": throwaway campaigns must start with "ZZ-".`);
  }
}

/**
 * The refusal that guards every delete. Checked against the RESOLVED id about to be deleted,
 * never against the arguments a caller passed — the same shape as `PROTECTED_SERVICE_IDS` in
 * the local teardown, and for the same reason: a wrong-but-plausible argument is exactly the
 * case a guard on the arguments would wave through.
 */
export function assertDeletableCampaign(campaignId: string | null | undefined): void {
  const id = String(campaignId ?? "").trim();
  if (!id) {
    throw new ProtectedCampaignError("(empty)", "no campaign id was recorded — nothing may be deleted by guesswork");
  }
  if (PROTECTED_CAMPAIGN_IDS.includes(id)) {
    const kind = TRACKED_CAMPAIGN_IDS.includes(id as any) ? "a TRACKED published campaign" : "a PRE-EXISTING ORPHAN";
    throw new ProtectedCampaignError(id, `it is ${kind}. 4c deletes only the campaign it created itself.`);
  }
}
