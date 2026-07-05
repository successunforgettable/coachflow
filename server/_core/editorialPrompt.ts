/**
 * Editorial ad-photo recipe — the gold-on-black "single art-directed shoot"
 * world (Stage 3), as a NEW selectable style beside the tabloid one. The
 * tabloid recipe (green circles/arrows, gossip-magazine look) is untouched and
 * lives in routers/adCreatives.ts.
 *
 * flux-2-pro takes a plain-text `prompt`, so the recipe is sectioned natural
 * language (positive-only). Each variation declares a copy ZONE — the clean
 * dark area the photo is told to leave — and the SAME zone is handed to the
 * render template (the photo↔text composition contract). Green-arrow/annotation
 * cues are deliberately absent here.
 */

export type EditorialZone = "left" | "bottom";

export type EditorialVariation = {
  key: string;
  formula: "benefit" | "social_proof" | "curiosity" | "contrast" | "challenge";
  /** Concept-driven action-in-setting (not a static pose). {niche} is filled in. */
  action: string;
  /** Whether a person leads, or an object/workspace. */
  mode: "person" | "object";
  /** Side the subject is composed to; drives the clean copy zone on the opposite side. */
  zone: EditorialZone;
};

// Five editorial concepts, parallel to the tabloid formula slots.
export const EDITORIAL_VARIATIONS: EditorialVariation[] = [
  { key: "desk_focus",   formula: "benefit",      mode: "person", zone: "left",
    action: "seated at a dark wood desk in a glass office, reading a printed report, calm and focused" },
  { key: "workspace",    formula: "social_proof", mode: "object", zone: "bottom",
    action: "a premium desk with a laptop and a printed document under a pool of light, no person" },
  { key: "lean_in",      formula: "curiosity",    mode: "person", zone: "left",
    action: "leaning forward at a boardroom table, mid-thought, direct and composed" },
  { key: "hero_object",  formula: "contrast",     mode: "object", zone: "bottom",
    action: "a single symbolic object of the trade resting on a dark surface, dramatically lit, no person" },
  { key: "lobby_walk",   formula: "challenge",    mode: "person", zone: "left",
    action: "walking through a glass corporate lobby at dusk, coat on, purposeful stride" },
];

/** Short, image-safe gist of the pressing problem — flavours the mood, never quoted. */
function moodGist(problem: string): string {
  const t = (problem || "").replace(/^\s*\d+\.\s*/g, "").replace(/["']/g, "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const cut = t.slice(0, 90);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 40 ? lastSpace : 90).trim();
}

/**
 * Build the editorial flux-2 prompt for one variation. Positive-only. Feeds the
 * niche (no "world" suffix) and a mood gist of the pressing problem into the
 * scene, and declares the clean copy zone the render template will place into.
 */
export function buildEditorialPrompt(v: EditorialVariation, niche: string, problem: string): string {
  const cleanNiche = (niche || "professionals").replace(/\s+/g, " ").trim();
  const gist = moodGist(problem);
  const subjectLine = v.mode === "person"
    ? `SUBJECT: one person aged 30-45 dressed sharply for the ${cleanNiche} field, ${v.action}, not looking at the camera.`
    : `SUBJECT: ${v.action}, styled for the ${cleanNiche} field.`;
  const zoneLine = v.zone === "left"
    ? `COMPOSITION: place the subject on the RIGHT side of the frame; leave the LEFT third a clean, uncluttered deep-shadow area with no subject or detail, reserved for a text overlay.`
    : `COMPOSITION: keep the subject in the upper two-thirds; leave the LOWER third a clean, uncluttered deep-shadow area with no subject or detail, reserved for a text overlay.`;

  return [
    `A premium editorial advertising photograph, cinematic and magazine-grade.`,
    subjectLine,
    gist ? `MOOD: quietly conveys the tension of ${gist}.` : "",
    `LIGHTING: low-key and moody, a near-black deep-charcoal background, with a warm gold rim and edge light shaping the subject. No flat daylight, no bright white studio.`,
    `CAMERA: 85mm lens, shallow depth of field, shot on a full-frame camera.`,
    `COLOR: deep charcoal and near-black with warm gold highlights.`,
    zoneLine,
    `The scene is entirely free of any text, letters, numbers, words, logos, or graphic overlays.`,
  ].filter(Boolean).join(" ");
}
