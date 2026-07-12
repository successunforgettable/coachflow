/**
 * Owner-locked plain-language labels for canonical [INSERT_*] placeholder tokens,
 * plus a humanizer that replaces any leftover raw token with its label.
 *
 * Shared so the trail card surfaces (V2Trail deck + reveal) and the Kit's
 * PlaceholderEditor use ONE label source. The trail applies
 * humanizeUnresolvedTokens AFTER resolveTokensInText, so a fillable token that
 * has no value yet shows a human label ("Your Qualification") instead of a raw
 * "[INSERT_COACH_CREDENTIAL]" leaking into a finished-looking card. Display-only —
 * stored asset rows keep the raw token; the Kit resolver + PlaceholderBanner are
 * the surface where the coach fills the real value.
 */

/** Canonical placeholder regex — mirrors resolveTokens.ts / placeholderDetector.ts. */
const TOKEN_PATTERN = /\[INSERT_[A-Z_0-9]+\]/g;

/** Owner-locked plain-language labels for canonical tokens. */
export const TOKEN_LABELS: Record<string, string> = {
  // Identity
  "[INSERT_HOST_NAME]": "Your Name",
  "[INSERT_CONTACT_EMAIL]": "Support Email",
  "[INSERT_OFFER_LINK]": "Offer / Checkout URL",
  "[INSERT_BOOKING_URL]": "Booking / Calendar URL",
  // Programme
  "[INSERT_OFFER_NAME]": "Offer Name",
  "[INSERT_PRICE]": "Price",
  "[INSERT_PROGRAMME_DURATION]": "Programme Duration",
  "[INSERT_PROGRAMME_START_DATE]": "Programme Start Date",
  "[INSERT_GUARANTEE_TERMS]": "Guarantee Terms",
  "[INSERT_COHORT_LIMIT]": "Spots Remaining",
  "[INSERT_COHORT_CLOSE_DATE]": "Offer Close Date",
  "[INSERT_DEADLINE]": "Offer Close Date",
  "[INSERT_CART_CLOSE_DATE]": "Offer Close Date",
  "[INSERT_FIRST_RESULT_TIMEFRAME]": "How Soon They See Results",
  "[INSERT_LEAD_MAGNET_NAME]": "Lead Magnet Name",
  // Bonuses
  "[INSERT_BONUS_1_NAME]": "Bonus 1 — Name",
  "[INSERT_BONUS_1_VALUE]": "Bonus 1 — Value",
  "[INSERT_BONUS_2_NAME]": "Bonus 2 — Name",
  "[INSERT_BONUS_2_VALUE]": "Bonus 2 — Value",
  "[INSERT_BONUS_3_NAME]": "Bonus 3 — Name",
  "[INSERT_BONUS_3_VALUE]": "Bonus 3 — Value",
  "[INSERT_BONUS_4_NAME]": "Bonus 4 — Name",
  "[INSERT_BONUS_4_VALUE]": "Bonus 4 — Value",
  "[INSERT_BONUS_5_NAME]": "Bonus 5 — Name",
  "[INSERT_BONUS_5_VALUE]": "Bonus 5 — Value",
  "[INSERT_BONUS_VALUE]": "Bonus Value",
  // Event
  "[INSERT_EVENT_NAME]": "Event Name",
  "[INSERT_EVENT_DATE]": "Event Date",
  "[INSERT_EVENT_TIME]": "Event Time",
  "[INSERT_EVENT_TIMEZONE]": "Event Timezone",
  "[INSERT_EVENT_DURATION]": "Event Duration",
  "[INSERT_EVENT_VENUE]": "Event Venue",
  "[INSERT_EVENT_AGENDA]": "Event Agenda",
  // Booking / discovery call
  "[INSERT_BOOKING_TIME]": "Call Time",
  "[INSERT_BOOKING_TIMEZONE]": "Call Timezone",
  "[INSERT_BOOKING_DURATION]": "Call Duration",
  // Product launch
  "[INSERT_LAUNCH_PRODUCT_NAME]": "Product Name",
  "[INSERT_CART_OPEN_DATE]": "Cart Opens",
  "[INSERT_CART_CLOSE_TIME]": "Cart Close Time",
  // Replay / post-event
  "[INSERT_REPLAY_URL]": "Replay Link",
  "[INSERT_REPLAY_EXPIRY]": "Replay Available Until",
  "[INSERT_REPLAY_AVAILABILITY]": "Who Can Watch the Replay",
  // Re-engagement
  "[INSERT_LAST_ENGAGEMENT_TIMEFRAME]": "Time Since Last Activity",
  "[INSERT_INCENTIVE]": "Come-Back Offer",
  // Event logistics
  "[INSERT_PARKING_INFO]": "Parking Details",
  "[INSERT_DRESS_CODE]": "Dress Code",
  "[INSERT_WHAT_TO_BRING]": "What to Bring",
  "[INSERT_ROOM_OR_FLOOR_INFO]": "Room / Floor",
  "[INSERT_DIETARY_NOTES]": "Dietary Notes",
  // Authority / credibility
  "[INSERT_COACH_CREDENTIAL]": "Your Qualification",
  "[INSERT_AUTHORITY_TITLE]": "Your Title",
  "[INSERT_FEATURED_IN]": "Featured In (Press / Media)",
};

/** Plain-language label for a token — owner-locked map, else a Title-Cased fallback. */
export function labelForToken(token: string): string {
  return TOKEN_LABELS[token] ?? token
    .replace(/^\[INSERT_/, "")
    .replace(/\]$/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Replace any remaining raw [INSERT_*] token in a string with its human label,
 * so a finished-looking surface never shows literal brackets. Apply AFTER
 * resolveTokensInText (which fills tokens that have values). Non-string / empty
 * input passes through untouched.
 */
export function humanizeUnresolvedTokens(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(TOKEN_PATTERN, (match) => labelForToken(match));
}
