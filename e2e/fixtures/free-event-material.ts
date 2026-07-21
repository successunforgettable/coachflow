/**
 * Fixture material for a FREE, IN-PERSON event campaign (2026-07-22).
 *
 * Deliberately contains NO price, NO event date, and NO city/venue in the prose — those are exactly the
 * operator facts the wizard must CAPTURE (free / a real venue / a date), not fabricate. If a generated asset
 * later names a city (London, Manchester, Atlanta…) or a price or a date, it invented it — which is what the
 * fabrication assertions catch. The coach here is a first-name-only test identity with a plain offer.
 */

export const COACH_NAME = "Jordan Blake";

/** The single paste blob the manual intake extracts offer / ICP / method from. No place, price, or date. */
export const FREE_EVENT_MATERIAL = `
I'm ${COACH_NAME}, a career coach. I run a live, in-person masterclass called "The Career Pivot Intensive"
for mid-career professionals (roughly 35–50) who feel stuck in a job that no longer fits and want to move
into work that actually suits them — without taking a pay cut or going back to study for years.

Who it's for: experienced professionals, usually managers or senior individual contributors, who are good at
their job but quietly miserable, and are scared that starting over means starting at the bottom.

My method is a three-part framework: (1) Map — get brutally honest about what you're actually good at and
what you want, (2) Bridge — find the roles that pay for those strengths without a reset, (3) Move — a
90-day plan to land the pivot. It's practical, no fluff, worksheets not theory.

The masterclass is a hands-on working session — people leave with their own pivot map drafted, not just
notes. It's the kind of room where you do the work with me in person rather than watch slides.
`.trim();

/** Words that would only appear in generated copy if a city/location was fabricated (never in the material). */
export const FABRICATED_CITY_WORDS = [
  "London", "Manchester", "Birmingham", "Leeds", "Bristol", "Glasgow", "Edinburgh", "Liverpool",
  "New York", "Los Angeles", "Chicago", "Atlanta", "Austin", "Miami", "Boston", "Dubai", "Singapore",
];

/** Non-place venue substitutions that mean a sentinel/placeholder leaked into the visible copy. */
export const BAD_VENUE_PHRASES = [
  "in in person", "at in person", "in In person", "at In Person", "__ONLINE__", "in __", "at __",
];
