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
    action: "a premium desk with a laptop and a printed document under a pool of light, photographed as a still life" },
  { key: "lean_in",      formula: "curiosity",    mode: "person", zone: "left",
    action: "leaning forward at a boardroom table, mid-thought, direct and composed" },
  { key: "hero_object",  formula: "contrast",     mode: "object", zone: "bottom",
    action: "a single symbolic object of the trade resting on a dark surface, dramatically lit, photographed as a still life" },
  { key: "lobby_walk",   formula: "challenge",    mode: "person", zone: "left",
    action: "walking through a glass corporate lobby at dusk, coat on, purposeful stride" },
];

// ─── Headline-driven scene brief (the varying "what's in frame") ─────────────
// The LLM micro-call returns ONE of these per headline — subject/action/setting/
// symbolic object + which side the copy zone sits. Everything else (lighting,
// palette, wardrobe register, camera, zone contract) is fixed by the recipe
// wrapper below, so scenes vary by headline while the world stays one shoot.
export type EditorialScene = {
  mode: "person" | "object";
  action: string;            // headline-specific mid-action + setting
  symbolicObject?: string;   // object-led scenes only
  zone: EditorialZone;       // clean copy-zone side
};

/** Fallback: a fixed slot variation → a scene (used when the micro-call is unavailable). */
export function variationToScene(v: EditorialVariation): EditorialScene {
  return { mode: v.mode, action: v.action, zone: v.zone };
}

/**
 * Wrap a scene brief in the LOCKED gold-on-black recipe. Positive-only. The
 * scene supplies only what's in frame; lighting/palette/wardrobe/camera and the
 * copy-zone contract are fixed here so a batch reads as one shoot.
 */
export function buildEditorialPrompt(scene: EditorialScene, niche: string): string {
  const cleanNiche = (niche || "professionals").replace(/\s+/g, " ").trim();
  const obj = scene.symbolicObject?.trim();
  // NEGATION SWEEP (2026-07-30) — this function carried FIVE absence-framings.
  // Diffusion conditioning has no logical NOT, so each named the thing it meant
  // to exclude and pushed it toward the frame. Every one is now stated as the
  // picture we want. See docs/handovers/AD_IMAGE_SITE_SWEEP_2026-07-30.md.
  const subjectLine = scene.mode === "person"
    ? `SUBJECT: one person aged 30-45 dressed sharply for the ${cleanNiche} field, ${scene.action}, their gaze off to one side.`
    : `SUBJECT: ${obj ? `${obj} — ` : ""}${scene.action}, styled for the ${cleanNiche} field, an object study only.`;
  const zoneLine = scene.zone === "left"
    ? `COMPOSITION: place the subject on the RIGHT side of the frame; keep the LEFT third a clean, uncluttered deep-shadow area of plain unbroken tone, reserved for a text overlay.`
    : `COMPOSITION: keep the subject in the upper two-thirds; keep the LOWER third a clean, uncluttered deep-shadow area of plain unbroken tone, reserved for a text overlay.`;

  return [
    `A premium editorial advertising photograph, cinematic and magazine-grade.`,
    subjectLine,
    // The trailing "No flat daylight, no bright white studio." is DELETED rather
    // than reworded. Everything before it already specifies the dark plate in
    // full, so this is plate-neutral by construction — which matters, because
    // compositeHeadline paints a fixed scrim and never inspects the plate, and
    // the "left" zone ramps to opacity 0 by 72% across. A brighter plate here
    // would be a legibility regression, so the safe edit is removal, not rewrite.
    `LIGHTING: low-key and moody, a near-black deep-charcoal background, with a warm gold rim and edge light shaping the subject.`,
    `CAMERA: 85mm lens, shallow depth of field, shot on a full-frame camera.`,
    `COLOR: deep charcoal and near-black with warm gold highlights.`,
    zoneLine,
    // Was: "entirely free of any text, letters, numbers, words, logos, or graphic
    // overlays" — the deleted tabloid `noText` string in another costume. It
    // enumerated every token it wanted absent, which is exactly how fix C put
    // newsprint and garbled book covers in frame. Mirrors the tabloid
    // cleanPlate wording, which rendered zero in-image text on 5/5.
    `Every surface in frame is blank and unmarked: plain walls, unbranded plain objects, blank paper, blank screens, plain untitled covers, plain fabric in solid colours.`,
  ].join(" ");
}

// ─── The headline→scene micro-call (batch: all headlines at once) ─────────────
const SCENE_SYSTEM_PROMPT =
  "You are a cinematic art director for premium gold-on-black editorial advertising, in the tradition of emotionally-driven brand campaigns. For each ad headline you design ONE scene that captures the emotional truth of that headline as a real, lived human business moment — a person in the grip of the feeling the headline names: the command of owning a room, the quiet sting of a loss, the focus of someone deciding, the tension before a turn. Show the person experiencing the situation, and let their body language, their expression, the other people in the frame, and the setting carry the meaning. Cast professionals in sharp business wardrobe within believable corporate worlds (glass offices, boardrooms, city towers at dusk, executive floors). You describe only what is in the frame and the emotion on it; lighting and colour are fixed and handled elsewhere. Vary the human moments so the set feels rich and cinematic while staying one cohesive shoot. Respond with valid JSON.";

const SCENE_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "editorial_scenes",
    strict: true,
    schema: {
      type: "object",
      properties: {
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["person", "object"] },
              action: { type: "string" },
              symbolicObject: { type: "string" },
              zone: { type: "string", enum: ["left", "bottom"] },
            },
            required: ["mode", "action", "symbolicObject", "zone"],
            additionalProperties: false,
          },
        },
      },
      required: ["scenes"],
      additionalProperties: false,
    },
  },
};

function validateScene(s: unknown): EditorialScene | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const mode = o.mode === "object" ? "object" : o.mode === "person" ? "person" : null;
  const zone = o.zone === "bottom" ? "bottom" : o.zone === "left" ? "left" : null;
  const action = typeof o.action === "string" ? o.action.trim() : "";
  if (!mode || !zone || action.length < 4) return null;
  const symbolicObject = typeof o.symbolicObject === "string" ? o.symbolicObject.trim() : undefined;
  return { mode, action, zone, symbolicObject: symbolicObject || undefined };
}

/**
 * Micro-call: one scene brief per headline (single batched LLM call). Falls back
 * per-slot to the fixed rotation for any missing/invalid brief, and for the
 * whole set on error — so editorial generation never breaks. Always returns a
 * valid scene for every headline (length === headlines.length).
 */
export async function generateEditorialSceneBriefs(headlines: string[], niche: string): Promise<EditorialScene[]> {
  const fallbackAt = (i: number) => variationToScene(EDITORIAL_VARIATIONS[i % EDITORIAL_VARIATIONS.length]);
  if (headlines.length === 0) return [];
  const { invokeLLM } = await import("./llm");
  const userPrompt = `Niche: ${(niche || "professionals").slice(0, 160)}

Design one scene per headline below. For each headline, find the emotional truth behind the words and render it as a real human business moment you could photograph. For each, return:
- mode: choose "person" — a human moment living the headline's feeling is almost always the right answer. Reserve "object" for the rare case where a single evocative object in the scene carries more feeling than a person could.
- action: the charged human moment that makes this headline's feeling real — what the person is doing, their body language and expression, who else is in frame and how, and the setting (e.g. "standing assured at the head of a boardroom as a deal closes, a rival deflated in the background" or "alone at their desk after hours, the weight of another rejection just landing on their face").
- symbolicObject: for the rare object-led scene, the one object that carries the emotion; empty string for person-led scenes.
- zone: "left" or "bottom" — the side kept clear for the text overlay; compose the subject on the opposite side.

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Return JSON: { "scenes": [ { "mode", "action", "symbolicObject", "zone" }, ... ] } with exactly ${headlines.length} scenes, in order.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SCENE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: SCENE_RESPONSE_FORMAT,
    });
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
    const out = headlines.map((_, i) => validateScene(scenes[i]) ?? fallbackAt(i));
    console.log(`[editorialScene] ${out.length} briefs (${out.filter((_, i) => validateScene(scenes[i])).length} from LLM, rest fallback)`);
    return out;
  } catch (err) {
    console.warn(`[editorialScene] micro-call failed, using slot fallback: ${err instanceof Error ? err.message : String(err)}`);
    return headlines.map((_, i) => fallbackAt(i));
  }
}
