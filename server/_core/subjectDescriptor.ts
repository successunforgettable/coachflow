/**
 * Subject resolution for ad-image prompts — P6 cause 2 (2026-07-29).
 *
 * THE PROBLEM. Every image style template described its subject as
 * "Person (30-45 years old)". No gender, no ICP, nothing. Five-of-five male is
 * simply what an unconditioned diffusion prior returns when asked for nothing.
 *
 * WHY THIS IS A RESOLUTION PROBLEM, NOT A CONCAT. `demographics.gender` holds
 * hedged POPULATION prose — measured on prod: "All genders, skewing slightly
 * female (55-60%)", "Mixed, slight skew male 55% / female 45%". A photograph
 * depicts ONE person. Interpolating that string yields either garbage or, worse,
 * the model latching onto "male 55%" inside a string that means the opposite.
 *
 * ARFEEN'S RULE (locked 2026-07-29) — the two halves interact:
 *   One audience, one depiction. An actually-mixed audience, both.
 *   - CLEAR ICP  -> PER BATCH. All five slots the same person type.
 *   - MIXED ICP  -> ALTERNATE across the five slots. Both represented.
 *   Never a coin flip. Never a silent default to the model's prior.
 *
 * POSITIVE FRAMING ONLY. Diffusion has no logical NOT. Every line here
 * describes the person we WANT; nothing is ever phrased as an absence. Proven
 * twice on 2026-07-29: "No people in the frame" was ignored while "an object
 * study only" worked on the identical run.
 */

export type SubjectGender = "female" | "male";

export type SubjectResolution = {
  /** resolved = one person type for the whole batch; mixed = alternate; unresolved = neutral wording */
  mode: "resolved" | "mixed" | "unresolved";
  gender: SubjectGender | null;
  /** Normalised age band for the prompt, e.g. "38-46". Null when unreadable. */
  ageBand: string | null;
  /** Which tier produced the decision — logged so we can see how often tier 3 / unresolved fires. */
  tier: 1 | 2 | 3 | null;
  /** Human-readable reason, for the log line. Never reaches a prompt. */
  evidence: string;
};

export type IcpSubjectInput = {
  demographics?: unknown;
  introduction?: string | null;
  fears?: string | null;
  hopesDreams?: string | null;
  frustrations?: string | null;
  psychographics?: string | null;
};

// ─── Age ─────────────────────────────────────────────────────────────────────

/**
 * Prefer an explicitly named core cluster over the outer band — "35-50, with the
 * core cluster at 38-46" describes a wide population but the photo wants the
 * centre of it. Normalises en/em dashes to a plain hyphen.
 */
export function resolveAgeBand(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[‒-―−]/g, "-").trim();
  if (!s) return null;
  const cluster = s.match(/(?:core\s+cluster|cluster|concentrat\w*|mostly|centred?)\D{0,12}(\d{2})\s*-\s*(\d{2})/i);
  if (cluster) return `${cluster[1]}-${cluster[2]}`;
  const band = s.match(/(\d{2})\s*-\s*(\d{2})/);
  if (band) return `${band[1]}-${band[2]}`;
  const single = s.match(/\b(\d{2})\b/);
  return single ? single[1] : null;
}

// ─── Tier 1: deterministic parse of the demographics skew ────────────────────

const STRONG_SKEW = /\b(mostly|predominantly|primarily|largely|overwhelmingly|almost\s+entirely|nearly\s+all)\b[^.;]{0,40}?\b(female|women|woman|male|men|man)\b/i;
const WEAK_SKEW = /\b(slightly|marginally|somewhat|a\s+little)\b[^.;]{0,40}?\b(female|women|woman|male|men|man)\b/i;
const BARE_TOKEN = /^\s*(female|women|woman|male|men|man)s?\s*$/i;
const EXPLICIT_MIXED = /\b(all\s+genders|mixed|both\s+genders|roughly\s+equal|equal\s+split|50\s*\/\s*50|even\s+split|no\s+strong\s+skew)\b/i;

const toGender = (word: string): SubjectGender | null => {
  const w = word.toLowerCase();
  if (/^(female|women|woman)/.test(w)) return "female";
  if (/^(male|men|man)/.test(w)) return "male";
  return null;
};

/**
 * Percentage pairs, e.g. "male 55% / female 45%" or "55% female". A gap under 20
 * points is a genuinely mixed audience, not a skew worth depicting as one person.
 */
function parsePercentages(s: string): { gender: SubjectGender; gap: number } | null {
  const hits: Record<SubjectGender, number> = { female: 0, male: 0 };
  const re = /\b(female|women|woman|male|men|man)\w*\s*[:\-–]?\s*(\d{1,3})\s*%|\b(\d{1,3})\s*%\s*(female|women|woman|male|men|man)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const word = m[1] ?? m[4];
    const pct = Number(m[2] ?? m[3]);
    const g = toGender(String(word));
    if (g && Number.isFinite(pct)) hits[g] = Math.max(hits[g], pct);
  }
  if (!hits.female && !hits.male) return null;
  // A single stated percentage implies its complement.
  const female = hits.female || (hits.male ? 100 - hits.male : 0);
  const male = hits.male || (hits.female ? 100 - hits.female : 0);
  const gap = Math.abs(female - male);
  return { gender: female >= male ? "female" : "male", gap };
}

function tier1(demographics: unknown): SubjectResolution | null {
  let genderRaw: unknown;
  if (typeof demographics === "string") {
    try { genderRaw = (JSON.parse(demographics) as Record<string, unknown>)?.gender; }
    catch { genderRaw = demographics; }
  } else if (demographics && typeof demographics === "object") {
    const d = demographics as Record<string, unknown>;
    genderRaw = d.gender ?? d.Gender;
  }
  if (typeof genderRaw !== "string" || !genderRaw.trim()) return null;
  const s = genderRaw.trim();

  const bare = s.match(BARE_TOKEN);
  if (bare) {
    const g = toGender(bare[1]);
    if (g) return { mode: "resolved", gender: g, ageBand: null, tier: 1, evidence: `bare token "${s}"` };
  }

  const strong = s.match(STRONG_SKEW);
  if (strong) {
    const g = toGender(strong[2]);
    if (g) return { mode: "resolved", gender: g, ageBand: null, tier: 1, evidence: `strong skew "${strong[0].trim()}"` };
  }

  const pct = parsePercentages(s);
  if (pct && pct.gap >= 20) {
    return { mode: "resolved", gender: pct.gender, ageBand: null, tier: 1, evidence: `percentage gap ${pct.gap}pts` };
  }

  // A WEAK skew over a population the field itself calls mixed is not a clear
  // audience — hand it to tier 2, which reads what the ICP actually says about
  // itself. This is the 2026-07-28 case: "All genders, skewing slightly female"
  // hedged, while the ICP's own words said "other mums in my antenatal group".
  if (WEAK_SKEW.test(s) || EXPLICIT_MIXED.test(s) || (pct && pct.gap < 20)) return null;

  return null;
}

// ─── Tier 2: the ICP's own first-person words ────────────────────────────────

/**
 * SELF-referential markers only. Bare pronouns are deliberately excluded: the
 * 2026-07-28 ICP says "I love her more than I knew was possible" about the BABY,
 * so "her" would have resolved the wrong way. Every marker here can only
 * describe the speaker.
 */
const FEMALE_MARKERS = [
  /\bother\s+mum(s)?\b/i, /\bother\s+mother(s)?\b/i, /\bfellow\s+mum(s)?\b/i,
  /\bas\s+a\s+(mum|mother)\b/i, /\ba\s+(worse|better|bad|good)\s+(mum|mother)\b/i,
  /\bi'?m\s+a\s+(mum|mother)\b/i, /\bmaternity\s+(leave|pay)\b/i,
  /\bantenatal\b/i, /\bpostnatal\b/i, /\bbreastfeed\w*\b/i, /\bmy\s+bump\b/i,
  /\bmum\s+guilt\b/i, /\bmums\s+in\s+my\b/i,
];
const MALE_MARKERS = [
  /\bother\s+dad(s)?\b/i, /\bother\s+father(s)?\b/i, /\bfellow\s+dad(s)?\b/i,
  /\bas\s+a\s+(dad|father)\b/i, /\ba\s+(worse|better|bad|good)\s+(dad|father)\b/i,
  /\bi'?m\s+a\s+(dad|father)\b/i, /\bpaternity\s+(leave|pay)\b/i,
  /\bdad\s+guilt\b/i, /\bdads\s+in\s+my\b/i,
];

function countMarkers(text: string, markers: RegExp[]): number {
  return markers.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

function tier2(icp: IcpSubjectInput): SubjectResolution | null {
  const text = [icp.introduction, icp.fears, icp.hopesDreams, icp.frustrations, icp.psychographics]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n");
  if (!text) return null;
  const f = countMarkers(text, FEMALE_MARKERS);
  const m = countMarkers(text, MALE_MARKERS);
  // Require an unambiguous majority: the other side silent, or outnumbered 3:1.
  if (f >= 2 && m === 0) return { mode: "resolved", gender: "female", ageBand: null, tier: 2, evidence: `${f} self-referential female markers, 0 male` };
  if (m >= 2 && f === 0) return { mode: "resolved", gender: "male", ageBand: null, tier: 2, evidence: `${m} self-referential male markers, 0 female` };
  if (f >= 3 && f >= m * 3) return { mode: "resolved", gender: "female", ageBand: null, tier: 2, evidence: `${f} female vs ${m} male markers` };
  if (m >= 3 && m >= f * 3) return { mode: "resolved", gender: "male", ageBand: null, tier: 2, evidence: `${m} male vs ${f} female markers` };
  if (f > 0 && m > 0) return { mode: "mixed", gender: null, ageBand: null, tier: 3, evidence: `${f} female and ${m} male markers — genuinely mixed` };
  return null;
}

// ─── Public: resolve ─────────────────────────────────────────────────────────

export function resolveSubjectDescriptor(icp: IcpSubjectInput | null | undefined): SubjectResolution {
  const ageBand = icp ? resolveAgeBand(
    (() => {
      const d = icp.demographics;
      if (typeof d === "string") { try { return (JSON.parse(d) as Record<string, unknown>)?.age_range; } catch { return null; } }
      if (d && typeof d === "object") { const o = d as Record<string, unknown>; return o.age_range ?? o.ageRange; }
      return null;
    })(),
  ) : null;

  if (!icp) return { mode: "unresolved", gender: null, ageBand: null, tier: null, evidence: "no ICP row" };

  const t1 = tier1(icp.demographics);
  if (t1) return { ...t1, ageBand };

  const t2 = tier2(icp);
  if (t2) return { ...t2, ageBand };

  // Tier 1 declined and tier 2 found nothing. If the demographics field itself
  // says "mixed", that IS a usable signal — alternate. Only a field with no
  // signal at all falls through to the neutral wording.
  const raw = (() => {
    const d = icp.demographics;
    if (typeof d === "string") { try { return String((JSON.parse(d) as Record<string, unknown>)?.gender ?? d); } catch { return d; } }
    if (d && typeof d === "object") { const o = d as Record<string, unknown>; return typeof o.gender === "string" ? o.gender : ""; }
    return "";
  })();
  if (raw && (EXPLICIT_MIXED.test(raw) || WEAK_SKEW.test(raw))) {
    return { mode: "mixed", gender: null, ageBand, tier: 3, evidence: `demographics states a mixed/weak-skew audience: "${raw.slice(0, 60)}"` };
  }

  return { mode: "unresolved", gender: null, ageBand, tier: null, evidence: raw ? `unreadable gender field: "${raw.slice(0, 60)}"` : "no gender signal in demographics or ICP text" };
}

// ─── Public: the prompt fragment ─────────────────────────────────────────────

const NOUN: Record<SubjectGender, string> = { female: "woman", male: "man" };

/**
 * Which styles actually depict a person. `screenshot` and `object` are still
 * lifes — they receive a subject clause but never interpolate it.
 */
const PERSON_STYLES = new Set(["person_shocked", "person_intense", "person_curious"]);
export const isPersonStyle = (style: string): boolean => PERSON_STYLES.has(style);

/**
 * The subject clause for one slot. POSITIVE FRAMING ONLY — this describes the
 * person to depict and never mentions the one to avoid.
 *
 * `resolved` returns the same clause for every slot (one audience, one
 * depiction); `unresolved` returns the pre-existing neutral wording.
 *
 * ⚠️ `personSlotOrdinal` is the index among the PERSON-BEARING slots, NOT the
 * variation index. This distinction is the whole correctness of the mixed path
 * and was found by live rendering on 2026-07-29, not by reasoning:
 *
 *   VARIATIONS = [person_shocked, screenshot, person_intense, object, person_curious]
 *                       0             1            2            3          4
 *
 * The person-bearing styles sit at indices 0, 2 and 4 — all EVEN. Alternating on
 * the variation index therefore assigned female to every slot that shows a
 * person and male only to the two still lifes, so a "mixed" ICP rendered three
 * women and zero men. Both-represented was defeated deterministically while the
 * unit tests passed, because the tests asserted the clause sequence rather than
 * what a viewer would see.
 */
export function subjectClause(r: SubjectResolution, personSlotOrdinal: number): string {
  const age = r.ageBand ?? "30-45";
  if (r.mode === "resolved" && r.gender) return `A ${NOUN[r.gender]} aged ${age}`;
  if (r.mode === "mixed") {
    const g: SubjectGender = personSlotOrdinal % 2 === 0 ? "female" : "male";
    return `A ${NOUN[g]} aged ${age}`;
  }
  return `Person (${age} years old)`;
}

/**
 * Per-variation subject clauses for a whole batch, given the style order.
 * Handles the person-ordinal bookkeeping so no caller has to — the bug above
 * came from a caller doing it wrong, so the correct form lives here now.
 */
export function subjectClausesForBatch(r: SubjectResolution, styles: string[]): string[] {
  let personOrdinal = 0;
  return styles.map(style => {
    const clause = subjectClause(r, isPersonStyle(style) ? personOrdinal : personOrdinal);
    if (isPersonStyle(style)) personOrdinal += 1;
    return clause;
  });
}

/** One line per batch so tier-3 and unresolved rates are visible in Railway logs. */
export function describeResolution(r: SubjectResolution): string {
  return `[subjectDescriptor] mode=${r.mode} gender=${r.gender ?? "-"} age=${r.ageBand ?? "-"} tier=${r.tier ?? "-"} — ${r.evidence}`;
}
