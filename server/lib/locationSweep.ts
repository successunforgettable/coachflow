/**
 * Deterministic location-fabrication sweep (2026-07-23, A7 / item 10).
 *
 * The event LP generator is prompt-locked to never invent a city (write [INSERT_EVENT_VENUE] instead), but
 * LLMs occasionally slip and emit a plausible city ("London") anyway. This is the deterministic backstop:
 * after generation, any city from the list below that the coach did NOT supply is replaced with the
 * [INSERT_EVENT_VENUE] token — which the facts-apply step then fills with the coach's real venue. A city the
 * coach DID supply (it appears in their venue answer) is kept. No fabricated location can survive to a
 * published page, regardless of LLM compliance.
 */

const VENUE_TOKEN = "[INSERT_EVENT_VENUE]";

// Major global cities an LLM is likely to invent for an in-person event. Superset of the harness fixture's
// list; a curated backstop, not an exhaustive gazetteer — the prompt lock is the primary defence.
const FABRICATABLE_CITIES = [
  // UK
  "London", "Manchester", "Birmingham", "Leeds", "Bristol", "Glasgow", "Edinburgh", "Liverpool",
  "Sheffield", "Cardiff", "Belfast", "Nottingham", "Leicester", "Newcastle", "Brighton", "Oxford", "Cambridge",
  // US
  "New York", "Los Angeles", "Chicago", "Atlanta", "Austin", "Miami", "Boston", "Seattle", "Denver",
  "Dallas", "Houston", "San Francisco", "Philadelphia", "Phoenix", "San Diego", "Nashville", "Portland", "Las Vegas",
  // Global
  "Dubai", "Singapore", "Toronto", "Sydney", "Melbourne", "Dublin", "Amsterdam", "Berlin", "Paris",
  "Mumbai", "Delhi", "Bangalore", "Hong Kong", "Tokyo",
];

/** Replace every fabricated city NOT present in the coach's supplied venue with the venue token. Pure. */
export function stripFabricatedLocations(text: string, suppliedVenue: string | null | undefined): string {
  if (typeof text !== "string" || !text) return text;
  const venue = (suppliedVenue ?? "").toLowerCase();
  let out = text;
  for (const city of FABRICATABLE_CITIES) {
    if (venue.includes(city.toLowerCase())) continue; // the coach really used it → keep
    out = out.replace(new RegExp(`\\b${escapeRe(city)}\\b`, "g"), VENUE_TOKEN);
  }
  // Collapse an accidental "[INSERT_EVENT_VENUE], [INSERT_EVENT_VENUE]" run (e.g. "London, England").
  return out.replace(new RegExp(`(${escapeRe(VENUE_TOKEN)})(\\s*,?\\s*${escapeRe(VENUE_TOKEN)})+`, "g"), VENUE_TOKEN);
}

/** Deep-sweep every string in an object/array (an LP angle blob) — immutable. */
export function sweepFabricatedLocationsDeep<T>(node: T, suppliedVenue: string | null | undefined): T {
  if (typeof node === "string") return stripFabricatedLocations(node, suppliedVenue) as unknown as T;
  if (Array.isArray(node)) return node.map((n) => sweepFabricatedLocationsDeep(n, suppliedVenue)) as unknown as T;
  if (node && typeof node === "object") {
    const out: any = {};
    for (const k in node as any) out[k] = sweepFabricatedLocationsDeep((node as any)[k], suppliedVenue);
    return out;
  }
  return node;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
