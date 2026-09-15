import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getTableColumns } from "drizzle-orm";
import { coachFacts } from "../drizzle/schema";
import {
  buildCoachFacts,
  COACH_FACT_KINDS,
  COACH_FACT_SOURCES,
  GENERATED_SERVICE_FIELDS,
  type BuildCoachFactsInput,
  type CoachFactRowInput,
  type CoachFactsResult,
} from "./_core/coachFacts";
import { METHOD_WALKTHROUGH } from "./_core/mechanismStandard";

/**
 * F1 — coach facts with provenance. Verdicts fixed in advance, before the builder was run:
 *   (a) generated "twelve years in HR" / "my husband" never become a groundable fact
 *   (b) two values for one single-valued slot → the newer is canonical, the older superseded
 *   (c) D-a: a confirmed rewording grounds a PRACTICE slot and is refused for BIOGRAPHY
 *   (d) coachBackground is read from users, not services
 *   (e) generated sources are excluded
 * Every negative assertion sits beside a positive artefact (§15k): the builder demonstrably returned
 * facts, and demonstrably recorded the refusal, so an empty result can never pass.
 */

const USER = 7;
const SERVICE = 319;

/** Every string anywhere in the result that could be used as evidence. */
const groundable = (r: CoachFactsResult) => [...r.facts.map((f) => f.value), ...Object.values(r.canonical).map((f) => f!.value)];
const everything = (r: CoachFactsResult) => [...groundable(r), ...r.superseded.map((f) => f.value)];

const row = (over: Partial<CoachFactRowInput>): CoachFactRowInput => ({
  id: 1, userId: USER, serviceId: null, factScope: "account", slot: "people_trained", slotKind: "credential",
  factValue: "900,000", sourceChannel: "coach_typed", sourceRef: "chatTranscripts:1#turn2",
  sourcedAt: new Date("2024-01-01T00:00:00Z"), supersededAt: null, ...over,
});

const methodRaw = [
  { label: "zappy asked", text: "Walk me through what happens when someone starts with you." },
  { label: "coach", text: "We map their week, then cut one meeting a day." },
  { label: "zappy asked", text: METHOD_WALKTHROUGH.differentiator },
  { label: "coach", text: "I make them delete their to-do app on day one." },
];

/** A realistic service row: two coach-typed proof fields, and generated text everywhere else. */
const baseInput = (): BuildCoachFactsInput => ({
  userId: USER,
  serviceId: SERVICE,
  user: { id: USER, coachBackground: "I coach new managers through their first ninety days." },
  service: {
    id: SERVICE, userId: USER, name: "First Ninety", category: "coaching",
    description: "Helps new managers lead with confidence", targetCustomer: "First-time managers",
    mainBenefit: "Lead a team without burning out",
    pressFeatures: "Forbes, HBR", socialProofStat: "4,000 MANAGERS COACHED",
    painPoints: "I spent twelve years in HR and still freeze in one-to-ones.",
    whyProblemExists: "My husband says I bring every meeting home with me.",
    uniqueMechanismSuggestion: "The twelve years in HR reset",
    avatarName: "Sarah", avatarTitle: "Twelve years in HR, now a team lead",
    riskReversal: "My husband would tell you it works.",
    failedSolutions: "Tried leadership books", hiddenReasons: "Fear of being found out",
    falseBeliefsVsRealReasons: "Thinks it is a skills gap",
  },
  icps: [{
    id: 51, userId: USER, serviceId: SERVICE,
    pains: "She has twelve years in HR behind her and my husband jokes about it.",
    groundingMeta: { ladderAnswers: { trigger: "She had just been promoted over her friends.", hesitation: "The price." } },
  }],
  coachMethod: {
    id: 9, userId: USER, serviceId: SERVICE, sourceTier: "coach_stated",
    differentiator: "After twelve years in HR I see what others miss.", ump: "my husband", ums: "x",
    rawMaterial: methodRaw, updatedAt: new Date("2026-08-01T00:00:00Z"),
  },
});

describe("(a) NEGATIVE CONTROL — generated biography never becomes a groundable fact", () => {
  it("returns the coach's other facts, and neither string appears anywhere in them", () => {
    const r = buildCoachFacts(baseInput());

    // Positive artefact: the builder read real sources and returned facts from each coach channel.
    const slots = r.facts.map((f) => f.slot);
    expect(slots).toEqual(expect.arrayContaining([
      "coach_background", "press_features", "social_proof_stat", "ladder_trigger", "ladder_hesitation", "method_differentiator",
    ]));
    // Positive artefact: the refusal is recorded, not silent.
    expect(r.excluded).toEqual(expect.arrayContaining([
      { sourceRef: `services:${SERVICE}.painPoints`, reason: "generated" },
      { sourceRef: `services:${SERVICE}.whyProblemExists`, reason: "generated" },
      { sourceRef: "coachMethods:9.differentiator", reason: "generated" },
    ]));

    for (const v of everything(r)) {
      expect(v).not.toMatch(/twelve years in HR/i);
      expect(v).not.toMatch(/my husband/i);
    }
  });

  it("control on the control: the same strings DO come through when the coach typed them", () => {
    // Proves the assertion above can fail (§15c). If the matcher or the builder were blind, this would fail.
    const input = baseInput();
    input.user = { id: USER, coachBackground: "I spent twelve years in HR. My husband ran the numbers." };
    const r = buildCoachFacts(input);
    expect(groundable(r).some((v) => /twelve years in HR/i.test(v))).toBe(true);
    expect(groundable(r).some((v) => /my husband/i.test(v))).toBe(true);
  });
});

describe("(b) supersession — the latest coach-supplied value of a single-valued slot is canonical", () => {
  const older = row({ id: 1, factValue: "900,000", sourcedAt: new Date("2024-01-01T00:00:00Z") });
  const newer = row({ id: 2, factValue: "1.2 million", sourcedAt: new Date("2026-09-01T00:00:00Z") });

  it.each([["older first", [older, newer]], ["newer first", [newer, older]]])("%s", (_label, rows) => {
    const r = buildCoachFacts({ userId: USER, factRows: rows });
    expect(r.canonical.people_trained?.value).toBe("1.2 million");
    expect(r.facts.map((f) => f.value)).toContain("1.2 million");
    expect(groundable(r)).not.toContain("900,000");
    expect(r.superseded.map((f) => f.value)).toEqual(["900,000"]);
    expect(r.excluded).toContainEqual({ sourceRef: older.sourceRef!, reason: "superseded" });
  });

  it("a row marked supersededAt never grounds, even when it carries the newest sourcedAt", () => {
    const marked = row({ id: 3, factValue: "2 million", sourcedAt: new Date("2026-09-10T00:00:00Z"),
      supersededAt: new Date("2026-09-11T00:00:00Z"), sourceRef: "chatTranscripts:3#turn1" });
    const r = buildCoachFacts({ userId: USER, factRows: [older, marked] });
    expect(r.canonical.people_trained?.value).toBe("900,000");
    expect(groundable(r)).not.toContain("2 million");
    expect(r.superseded.map((f) => f.value)).toContain("2 million");
  });

  it("equal sourcedAt: the later row id wins, independent of input order", () => {
    const at = new Date("2026-09-01T00:00:00Z");
    const a = row({ id: 10, factValue: "30", slot: "countries", sourcedAt: at });
    const b = row({ id: 11, factValue: "31", slot: "countries", sourcedAt: at });
    expect(buildCoachFacts({ userId: USER, factRows: [b, a] }).canonical.countries?.value).toBe("31");
    expect(buildCoachFacts({ userId: USER, factRows: [a, b] }).canonical.countries?.value).toBe("31");
  });

  it("a multi-valued slot keeps every current value", () => {
    const r = buildCoachFacts({ userId: USER, factRows: [
      row({ id: 1, slot: "who_they_help", slotKind: "practice", factValue: "new managers" }),
      row({ id: 2, slot: "who_they_help", slotKind: "practice", factValue: "team leads", sourceRef: "chatTranscripts:2#turn1" }),
    ] });
    expect(r.facts.map((f) => f.value)).toEqual(["new managers", "team leads"]);
    expect(r.superseded).toEqual([]);
  });
});

describe("(c) D-a — a confirmed rewording counts for practice facts only, never biography", () => {
  const rewording = (over: Partial<CoachFactRowInput>) =>
    row({ sourceChannel: "coach_confirmed_rewording", sourcedAt: new Date("2026-09-01T00:00:00Z"), ...over });

  it("accepted for a practice slot, refused for biography and credential slots", () => {
    const practice = rewording({ id: 1, slot: "who_they_help", slotKind: "practice", factValue: "First-time managers in tech", sourceRef: "r:1" });
    const bio = rewording({ id: 2, slot: "years_experience", slotKind: "biography", factValue: "twelve years", sourceRef: "r:2" });
    const cred = rewording({ id: 3, slot: "headline_credential", slotKind: "credential", factValue: "ICF PCC", sourceRef: "r:3" });
    const r = buildCoachFacts({ userId: USER, factRows: [practice, bio, cred] });

    expect(r.facts).toEqual([expect.objectContaining({ slot: "who_they_help", source: "coach_confirmed_rewording", value: "First-time managers in tech" })]);
    expect(r.excluded).toEqual(expect.arrayContaining([
      { sourceRef: "r:2", reason: "rewording_not_evidence_for_kind" },
      { sourceRef: "r:3", reason: "rewording_not_evidence_for_kind" },
    ]));
    expect(r.canonical.years_experience).toBeUndefined();
    expect(r.canonical.headline_credential).toBeUndefined();
  });

  it("the same biography value grounds when the coach typed it", () => {
    const typed = row({ id: 4, slot: "years_experience", slotKind: "biography", factValue: "twelve years", sourceRef: "r:4" });
    expect(buildCoachFacts({ userId: USER, factRows: [typed] }).canonical.years_experience?.value).toBe("twelve years");
  });

  it("the services-row rewording is NOT treated as confirmed: no confirmation is persisted (fail closed)", () => {
    const r = buildCoachFacts(baseInput());
    for (const k of ["description", "targetCustomer", "mainBenefit"]) {
      expect(r.excluded).toContainEqual({ sourceRef: `services:${SERVICE}.${k}`, reason: "unconfirmed_rewording" });
    }
    expect(groundable(r)).not.toContain("Helps new managers lead with confidence");
    expect(groundable(r)).not.toContain("First-time managers");
    expect(r.facts.length).toBeGreaterThan(0);
  });
});

describe("(d) coachBackground is read from USERS", () => {
  it("uses users.coachBackground and ignores a coachBackground on the services object", () => {
    const input = baseInput();
    input.user = { id: USER, coachBackground: "USERS ROW BIO" };
    input.service = { ...input.service!, coachBackground: "SERVICES OBJECT BIO" };
    const r = buildCoachFacts(input);
    expect(r.facts).toContainEqual({
      slot: "coach_background", kind: "biography", value: "USERS ROW BIO",
      source: "account_profile", sourceRef: `users:${USER}.coach_background`, sourcedAt: null,
    });
    expect(everything(r)).not.toContain("SERVICES OBJECT BIO");
    expect(r.excluded).toContainEqual({ sourceRef: `services:${SERVICE}.coachBackground`, reason: "wrong_table" });
  });

  it("another user's profile never grounds", () => {
    const input = baseInput();
    input.user = { id: USER + 1, coachBackground: "SOMEONE ELSE" };
    const r = buildCoachFacts(input);
    expect(everything(r)).not.toContain("SOMEONE ELSE");
    expect(r.excluded).toContainEqual({ sourceRef: `users:${USER + 1}.coach_background`, reason: "wrong_owner" });
  });
});

describe("(e) generated sources are excluded", () => {
  it("no generated services field, ICP prose or method distillation reaches a fact", () => {
    const input = baseInput();
    const markers: string[] = [];
    for (const k of GENERATED_SERVICE_FIELDS) {
      const m = `GEN-MARKER-${k}`;
      markers.push(m);
      (input.service as Record<string, unknown>)[k] = m;
    }
    Object.assign(input.icps![0], { pains: "GEN-ICP-PAINS", goals: "GEN-ICP-GOALS", psychographics: "GEN-ICP-PSY" });
    Object.assign(input.coachMethod!, { ump: "GEN-UMP", ums: "GEN-UMS", oldVehicle: "GEN-OLD", differentiator: "GEN-DIFF",
      steps: [{ name: "GEN-STEP", whatHappens: "GEN-STEP-WHAT" }] });
    markers.push("GEN-ICP-PAINS", "GEN-ICP-GOALS", "GEN-ICP-PSY", "GEN-UMP", "GEN-UMS", "GEN-OLD", "GEN-DIFF", "GEN-STEP");

    const r = buildCoachFacts(input);
    for (const v of everything(r)) for (const m of markers) expect(v).not.toContain(m);

    // Positive artefacts: every generated services field is recorded as refused, and coach facts still flow.
    for (const k of GENERATED_SERVICE_FIELDS) {
      expect(r.excluded).toContainEqual({ sourceRef: `services:${SERVICE}.${k}`, reason: "generated" });
    }
    expect(r.facts).toContainEqual(expect.objectContaining({
      slot: "method_differentiator", value: "I make them delete their to-do app on day one.", sourceRef: "coachMethods:9.rawMaterial[3]",
    }));
  });

  it("a method that was not coach_stated contributes nothing, not even its transcript", () => {
    const input = baseInput();
    input.coachMethod = { ...input.coachMethod!, sourceTier: "extracted" };
    const r = buildCoachFacts(input);
    expect(r.facts.some((f) => f.slot === "method_differentiator")).toBe(false);
    expect(r.excluded).toContainEqual({ sourceRef: "coachMethods:9.rawMaterial", reason: "not_coach_supplied" });
    expect(r.facts.some((f) => f.slot === "coach_background")).toBe(true);
  });

  it("testimonials: only coach_supplied library rows ground; seeded, imported, untagged and services-row quotes do not", () => {
    const input = baseInput();
    input.service = { ...input.service!, testimonial1Quote: "Our lead quality jumped 40%", testimonial1Name: "Sarah Chen" };
    input.testimonials = [
      { id: 1, userId: USER, serviceId: SERVICE, quote: "REAL SERVICE QUOTE", scope: "service_specific", source: "coach_supplied" },
      { id: 2, userId: USER, serviceId: null, quote: "REAL PORTABLE QUOTE", scope: "coach_portable", source: "coach_supplied" },
      { id: 3, userId: USER, serviceId: null, quote: "SEEDED QUOTE", scope: "coach_portable", source: "seeded_demo" },
      { id: 4, userId: USER, serviceId: SERVICE, quote: "IMPORTED QUOTE", scope: "service_specific", source: "imported" },
      { id: 5, userId: USER, serviceId: null, quote: "UNTAGGED QUOTE", scope: null, source: "coach_supplied" },
      { id: 6, userId: USER, serviceId: SERVICE + 1, quote: "OTHER SERVICE QUOTE", scope: "service_specific", source: "coach_supplied" },
    ];
    const r = buildCoachFacts(input);
    const quotes = r.facts.filter((f) => f.slot === "testimonial").map((f) => f.value);
    expect(quotes).toEqual(["REAL SERVICE QUOTE", "REAL PORTABLE QUOTE"]);
    for (const bad of ["SEEDED QUOTE", "IMPORTED QUOTE", "UNTAGGED QUOTE", "OTHER SERVICE QUOTE", "Our lead quality jumped 40%"]) {
      expect(everything(r)).not.toContain(bad);
    }
    expect(r.excluded).toContainEqual({ sourceRef: `services:${SERVICE}.testimonial1Quote`, reason: "provenance_unrecorded" });
  });
});

describe("scope, ownership and A2 offer facts", () => {
  it("a service-scoped row whose service was deleted (serviceId SET NULL) is orphaned, never account-wide", () => {
    const orphan = row({ id: 1, factScope: "service", serviceId: null, slot: "who_they_help", slotKind: "practice", factValue: "ORPHAN" });
    const other = row({ id: 2, factScope: "service", serviceId: SERVICE + 1, slot: "who_they_help", slotKind: "practice", factValue: "OTHER", sourceRef: "r:2" });
    const mine = row({ id: 3, factScope: "service", serviceId: SERVICE, slot: "who_they_help", slotKind: "practice", factValue: "MINE", sourceRef: "r:3" });
    const r = buildCoachFacts({ userId: USER, serviceId: SERVICE, factRows: [orphan, other, mine] });
    expect(r.facts.map((f) => f.value)).toEqual(["MINE"]);
    expect(r.excluded).toEqual(expect.arrayContaining([
      { sourceRef: orphan.sourceRef!, reason: "orphaned_scope" },
      { sourceRef: "r:2", reason: "out_of_scope" },
    ]));
  });

  it("rows with an unknown channel, kind or a missing sourcedAt are refused, not guessed", () => {
    const r = buildCoachFacts({ userId: USER, factRows: [
      row({ id: 1, sourceChannel: "generated", sourceRef: "r:1" }),
      row({ id: 2, slotKind: "vibe", sourceRef: "r:2" }),
      row({ id: 3, sourcedAt: null, sourceRef: "r:3" }),
      row({ id: 4, userId: USER + 1, sourceRef: "r:4" }),
      row({ id: 5, factValue: "OK", slot: "clients_served", sourceRef: "r:5" }),
    ] });
    expect(r.facts.map((f) => f.value)).toEqual(["OK"]);
    expect(r.excluded.map((e) => e.reason)).toEqual(["invalid_row", "invalid_row", "invalid_row", "wrong_owner"]);
  });

  it("operator-captured campaign facts ground as offer facts; the campaign token row beats the account default", () => {
    const r = buildCoachFacts({
      userId: USER, serviceId: SERVICE,
      kit: { id: 225, userId: USER, campaignFacts: JSON.stringify({
        eventSchedule: { date: "Sunday 12 October", time: "7pm", timezone: "GST", venue: "" }, price: { amount: "497" } }) },
      placeholderValues: [
        { id: 1, userId: USER, serviceId: null, token: "[INSERT_GUARANTEE_TERMS]", value: "ACCOUNT DEFAULT" },
        { id: 2, userId: USER, serviceId: SERVICE, token: "[INSERT_GUARANTEE_TERMS]", value: "30-day refund" },
        { id: 3, userId: USER, serviceId: SERVICE, token: "[INSERT_COACH_CREDENTIAL]", value: "ICF PCC" },
        { id: 4, userId: USER, serviceId: SERVICE, token: "[INSERT_COHORT_LIMIT]", value: "__SKIP__" },
      ],
    });
    expect(r.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ slot: "event_date", kind: "offer", value: "Sunday 12 October", source: "operator_capture",
        sourceRef: "campaignKits:225.campaignFacts.eventSchedule.date" }),
      expect.objectContaining({ slot: "event_time", value: "7pm" }),
      expect.objectContaining({ slot: "offer_price", value: "497" }),
      expect.objectContaining({ slot: "operator_token:guarantee_terms", kind: "offer", value: "30-day refund" }),
      expect.objectContaining({ slot: "operator_token:coach_credential", kind: "credential", value: "ICF PCC" }),
    ]));
    expect(everything(r)).not.toContain("ACCOUNT DEFAULT");
    expect(everything(r)).not.toContain("__SKIP__");
    expect(r.facts.some((f) => f.slot === "event_venue")).toBe(false);
  });
});

describe("schema, migration and builder agree (no local DB was available to apply 0111)", () => {
  const sql = readFileSync(resolve(__dirname, "../drizzle/0111_coach_facts.sql"), "utf8");
  const create = sql.slice(sql.indexOf("CREATE TABLE `coachFacts`"));
  const enumIn = (col: string) => {
    const m = create.match(new RegExp("`" + col + "` ENUM\\(([^)]*)\\)"));
    return m ? m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, "")) : [];
  };

  it("the migration's columns are exactly the Drizzle table's columns", () => {
    const sqlCols = Array.from(create.matchAll(/^\s*`(\w+)`\s+(?:INT|ENUM|VARCHAR|TEXT|TIMESTAMP)/gm)).map((m) => m[1]);
    const drizzleCols = Object.values(getTableColumns(coachFacts)).map((c) => c.name);
    expect(sqlCols.length).toBe(12);
    expect(sqlCols).toEqual(drizzleCols);
  });

  it("enum values match across migration, Drizzle and the builder", () => {
    expect(enumIn("sourceChannel")).toEqual([...COACH_FACT_SOURCES]);
    expect(coachFacts.sourceChannel.enumValues).toEqual([...COACH_FACT_SOURCES]);
    expect(enumIn("slotKind")).toEqual([...COACH_FACT_KINDS]);
    expect(coachFacts.slotKind.enumValues).toEqual([...COACH_FACT_KINDS]);
    expect(enumIn("factScope")).toEqual(["account", "service"]);
  });

  it("sourcedAt has no default; the FKs cascade on user and SET NULL on service; nothing is inserted", () => {
    expect(create).toMatch(/`sourcedAt` TIMESTAMP NOT NULL,/);
    expect(create).toMatch(/FOREIGN KEY \(`userId`\) REFERENCES `users`\(`id`\) ON DELETE CASCADE/);
    expect(create).toMatch(/FOREIGN KEY \(`serviceId`\) REFERENCES `services`\(`id`\) ON DELETE SET NULL/);
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|ALTER)\b/im);
  });
});
