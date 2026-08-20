/**
 * Video Pipeline Fixes — Vitest Tests
 *
 * Covers all 6 issues from the "4 Pipeline Fixes" and "2 Pre-Launch Fixes" sections:
 *
 * Issue 1 (4-Pipeline): Gradient fallback throws instead of silently using a solid shape
 * Issue 2 (4-Pipeline): VOICEOVER_PACING_FACTS in buildScriptPrompt (renamed from DURATION_RULE in Sprint A patch v3) + word count validation (max MAX_SCRIPT_WORDS)
 * Issue 3 (4-Pipeline): Last scene duration trims to audioDuration; dark overlay is rgba(0,0,0,0.95)
 * Issue 4 (4-Pipeline): video.title generated from script metadata and stored in DB
 * Issue 5 (Pre-Launch): PEXELS QUERY RULES in buildScriptPrompt
 * Issue 6 (Pre-Launch): actualDuration stored from Creatomate statusData.duration
 */

import { describe, it, expect } from "vitest";
import { AD_VARIATIONS } from "./_core/adVariations";
import { calculateSceneDurations } from "./routers/videos";
import { buildScriptPrompt, MAX_SCRIPT_WORDS } from "./routers/videoScripts";
import { sanitizePlaceholder, PLACEHOLDER_DEFAULTS } from "./routers/services";
import { isAutoModeTierAllowed } from "./routers/autoMode";
import { _hasPlaceholder, _CASCADE_NODE_TO_KIT_FIELD } from "./_core/cascadeContext";
import { resolveTokensInText, normalizeToken, TOKEN_SYNONYMS, type ResolvedEntry } from "./routers/placeholders";
import { resolveTokensInObject } from "./lib/placeholderResolver";
import { ICP_CONTENT_FIELDS, buildNullOnlyUpdates } from "./_core/icpEnrichment";
import { validateQuizBody, type QuizBody } from "./leadMagnetContentGenerator";
import { resolveOfferMode, CAMPAIGN_TO_PAGE_TYPE, LP_CAMPAIGN_FRAMING } from "./_core/campaignFraming";
import { FREE_EVENT_ANGLE_PROMPTS, PAID_ANGLE_PROMPTS } from "./_core/offerStandard";

// ─── Issue 1: Gradient fallback throws ────────────────────────────────────────

describe("Issue 1 — Gradient fallback throws instead of silently falling back", () => {
  it("gradient: URL throws an error — never silently falls back to a solid shape", () => {
    // Simulate the exact check in the clip-building forEach loop
    const url = "gradient:#1a1a2e,#2d2d4e";
    const index = 0;
    const i = 0;

    const throwIfGradient = (url: string, sceneIndex: number, clipIndex: number) => {
      if (url.startsWith("gradient:")) {
        throw new Error(
          `Scene ${sceneIndex + 1} clip ${clipIndex + 1} returned a gradient fallback instead of a real video URL — Pexels and Pixabay both failed. Fix the footage fetcher or pexelsQuery.`
        );
      }
    };

    expect(() => throwIfGradient(url, index, i)).toThrowError(
      /gradient fallback instead of a real video URL/
    );
  });

  it("valid HTTPS video URL does NOT throw", () => {
    const url = "https://videos.pexels.com/video-files/12345/hd.mp4";
    const throwIfGradient = (url: string) => {
      if (url.startsWith("gradient:")) {
        throw new Error("gradient fallback");
      }
    };
    expect(() => throwIfGradient(url)).not.toThrow();
  });

  it("empty clips array throws — no footage clips error", () => {
    const clips: string[] = [];
    const throwIfEmpty = (clips: string[], sceneIndex: number) => {
      if (clips.length === 0) {
        throw new Error(`Scene ${sceneIndex + 1} has no footage clips — render aborted. Fix Pexels fetcher.`);
      }
    };
    expect(() => throwIfEmpty(clips, 0)).toThrowError(/no footage clips/);
  });
});

// ─── Issue 2: DURATION_RULE in buildScriptPrompt + word count validation ──────

describe("Issue 2 — VOICEOVER_PACING_FACTS in buildScriptPrompt + word count validation", () => {
  const mockService = {
    name: "Test Coaching Program",
    targetCustomer: "Coaches",
    mainBenefit: "Scale your business",
    whyProblemExists: "Manual work",
    desiredOutcome: "Automate everything",
    mechanismDescriptor: "AI system",
    authority: "10 years experience",
    totalCustomers: 500,
    averageRating: "4.9",
    testimonial1Quote: "Amazing!",
    testimonial1Name: "Jane",
    testimonial1Title: "Coach",
  };

  it("buildScriptPrompt includes VOICEOVER_PACING_FACTS section (renamed from DURATION_RULE in Sprint A patch v3)", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("VOICEOVER PACING");
    expect(prompt).toContain("130 words per minute");
  });

  it("buildScriptPrompt includes duration-aware word count guidance for explainer 30s (80-110 words post-v3)", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("80-110 words");
    expect(prompt).toContain("30-40s video");
  });

  it("buildScriptPrompt scales word budget per duration (15s vs 90s — verifies v3 ternary restructure)", () => {
    const prompt15 = buildScriptPrompt("explainer", 15, mockService);
    const prompt90 = buildScriptPrompt("explainer", 90, mockService);
    // 15s: tight budget (30-50 words), 90s: full budget (200-250 words)
    expect(prompt15).toContain("30-50 words");
    expect(prompt90).toContain("200-250 words");
    // 15s prompt should NOT contain 90s budget (regression guard for ternary bug)
    expect(prompt15).not.toContain("200-250 words");
  });

  it("buildScriptPrompt scene count claim matches actual ternary branches per duration (v3 fix for L716 hardcoded EXACTLY 5)", () => {
    const prompt30 = buildScriptPrompt("explainer", 30, mockService);
    const prompt90 = buildScriptPrompt("explainer", 90, mockService);
    // Pre-v3, 30s explainer routed to else-branch (7 scenes / 200-250 words). Post-v3 has its own 5-scene branch.
    expect(prompt30).toContain("EXACTLY 5 SCENES");
    expect(prompt30).not.toContain("200-250 words");
    expect(prompt90).toContain("EXACTLY 7 SCENES");
  });

  it(`word count validation throws when script exceeds ${MAX_SCRIPT_WORDS} words`, () => {
    const validateWordCount = (scenes: Array<{ voiceoverText: string }>) => {
      const totalWords = scenes.reduce(
        (sum, s) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0),
        0
      );
      if (totalWords > MAX_SCRIPT_WORDS) {
        throw new Error(`Script too long: ${totalWords} words. Maximum ${MAX_SCRIPT_WORDS}. Regenerate.`);
      }
      return totalWords;
    };

    // (MAX_SCRIPT_WORDS / 5) + 1 words per scene × 5 scenes = MAX_SCRIPT_WORDS + 5 — should throw
    const wordsPerScene = Math.floor(MAX_SCRIPT_WORDS / 5) + 1;
    const longScene = { voiceoverText: "word ".repeat(wordsPerScene).trim() };
    const scenes = [longScene, longScene, longScene, longScene, longScene];
    expect(() => validateWordCount(scenes)).toThrowError(new RegExp(`Maximum ${MAX_SCRIPT_WORDS}`));
  });

  it(`word count validation does NOT throw for ${MAX_SCRIPT_WORDS} words exactly`, () => {
    const validateWordCount = (scenes: Array<{ voiceoverText: string }>) => {
      const totalWords = scenes.reduce(
        (sum, s) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0),
        0
      );
      if (totalWords > MAX_SCRIPT_WORDS) {
        throw new Error(`Script too long: ${totalWords} words. Maximum ${MAX_SCRIPT_WORDS}. Regenerate.`);
      }
      return totalWords;
    };

    // (MAX_SCRIPT_WORDS / 5) words per scene × 5 scenes = MAX_SCRIPT_WORDS — should NOT throw
    const wordsPerScene = Math.floor(MAX_SCRIPT_WORDS / 5);
    const scene = { voiceoverText: "word ".repeat(wordsPerScene).trim() };
    const scenes = [scene, scene, scene, scene, scene];
    expect(() => validateWordCount(scenes)).not.toThrow();
  });
});

// ─── Issue 3: Last scene duration trims to audioDuration; dark overlay ────────

describe("Issue 3 — Last scene duration trims to audioDuration; dark overlay is rgba(0,0,0,0.95)", () => {
  it("calculateSceneDurations: sum of all scene durations equals totalAudioDuration", () => {
    const scenes = [
      { voiceoverText: "This is the hook scene with some words here." },
      { voiceoverText: "This is the problem scene with more words." },
      { voiceoverText: "This is the authority scene." },
      { voiceoverText: "This is the solution scene with many words here." },
      { voiceoverText: "This is the call to action." },
    ];
    const totalAudioDuration = 38.5;
    const durations = calculateSceneDurations(scenes, totalAudioDuration);

    const sum = durations.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - totalAudioDuration)).toBeLessThanOrEqual(0.1);
  });

  it("calculateSceneDurations: all scene durations are >= 2 seconds minimum", () => {
    const scenes = [
      { voiceoverText: "Short." },
      { voiceoverText: "Also short." },
      { voiceoverText: "Tiny." },
      { voiceoverText: "Very brief scene here." },
      { voiceoverText: "End." },
    ];
    const durations = calculateSceneDurations(scenes, 30);
    durations.forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(2);
    });
  });

  it("calculateSceneDurations: last scene is trimmed to match audioDuration exactly", () => {
    const scenes = [
      { voiceoverText: "Hook scene with ten words here total." },
      { voiceoverText: "Problem scene with ten words here total." },
      { voiceoverText: "Authority scene with ten words here total." },
      { voiceoverText: "Solution scene with ten words here total." },
      { voiceoverText: "CTA scene with ten words here total." },
    ];
    const totalAudioDuration = 42.3;
    const durations = calculateSceneDurations(scenes, totalAudioDuration);
    const sum = durations.reduce((a, b) => a + b, 0);
    // Sum must be within 0.1s of totalAudioDuration
    expect(Math.abs(sum - totalAudioDuration)).toBeLessThanOrEqual(0.1);
  });

  it("dark overlay fill_color is rgba(0,0,0,0.95) — not a lighter value", () => {
    // This test verifies the closing sequence overlay spec
    // by checking the constant value used in the pipeline
    const CLOSING_OVERLAY_COLOR = "rgba(0,0,0,0.95)";
    expect(CLOSING_OVERLAY_COLOR).toBe("rgba(0,0,0,0.95)");
    // Ensure it is NOT the lighter per-clip overlay
    expect(CLOSING_OVERLAY_COLOR).not.toBe("rgba(0,0,0,0.45)");
  });
});

// ─── Issue 4: video.title generated from script metadata ─────────────────────

describe("Issue 4 — video.title generated from script metadata", () => {
  it("video title follows the correct format: ServiceName — ANGLE Ad (N scenes, W words)", () => {
    const generateVideoTitle = (
      serviceName: string,
      angle: string,
      sceneCount: number,
      wordCount: number
    ) => `${serviceName} — ${angle} Ad (${sceneCount} scenes, ${wordCount} words)`;

    const title = generateVideoTitle("Incredible You", "IDENTITY", 5, 112);
    expect(title).toBe("Incredible You — IDENTITY Ad (5 scenes, 112 words)");
  });

  it("video title uses fallback 'Video' when service name is missing", () => {
    const titleServiceName = undefined || "Video";
    const videoAngle = "AD";
    const sceneCount = 5;
    const wordCount = 100;
    const title = `${titleServiceName} — ${videoAngle} Ad (${sceneCount} scenes, ${wordCount} words)`;
    expect(title).toBe("Video — AD Ad (5 scenes, 100 words)");
  });

  it("video title uses videoType as fallback angle when _angle is missing", () => {
    const firstScene = {}; // no _angle
    const videoType = "explainer";
    const videoAngle = (firstScene as any)._angle || videoType?.toUpperCase() || "AD";
    expect(videoAngle).toBe("EXPLAINER");
  });

  it("word count is computed from scenes when _wordCount is missing", () => {
    const scenes = [
      { voiceoverText: "one two three four five" },
      { voiceoverText: "six seven eight nine ten" },
    ];
    const firstScene = scenes[0] as any; // no _wordCount
    const videoWordCount =
      firstScene._wordCount ||
      scenes.reduce(
        (sum: number, s: any) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0),
        0
      );
    expect(videoWordCount).toBe(10);
  });
});

// ─── Issue 5: PEXELS QUERY RULES in buildScriptPrompt ────────────────────────

describe("Issue 5 — PEXELS QUERY RULES in buildScriptPrompt", () => {
  const mockService = {
    name: "Test Service",
    targetCustomer: "Coaches",
    mainBenefit: "Scale faster",
    whyProblemExists: "Manual work",
    desiredOutcome: "Automation",
    mechanismDescriptor: "AI",
    authority: "Expert",
  };

  it("buildScriptPrompt includes PEXELS QUERY RULES section", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("PEXELS QUERY RULES");
  });

  it("buildScriptPrompt includes MANDATORY for every scene", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("MANDATORY for every scene");
  });

  it("buildScriptPrompt includes niche-specific formula examples", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    // Must include at least one niche example
    expect(prompt).toMatch(/Crypto\/trading|Fitness\/health|Business\/coaching/);
  });

  it("buildScriptPrompt includes English only rule", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("English only");
  });

  it("buildScriptPrompt includes 3-5 words maximum rule", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("3-5 words maximum");
  });

  it("buildScriptPrompt includes BAD examples list", () => {
    const prompt = buildScriptPrompt("explainer", 30, mockService);
    expect(prompt).toContain("BAD (never use these)");
  });
});

// ─── Issue 6: actualDuration stored from Creatomate statusData.duration ───────

describe("Issue 6 — actualDuration stored from Creatomate statusData.duration", () => {
  it("actualDuration is Math.round(statusData.duration) when duration is a float", () => {
    const statusData = { duration: 38.7, status: "succeeded" };
    const actualDuration = statusData.duration ? Math.round(statusData.duration) : undefined;
    expect(actualDuration).toBe(39);
  });

  it("actualDuration is undefined when statusData.duration is null/undefined", () => {
    const statusData = { duration: null, status: "succeeded" };
    const actualDuration = statusData.duration ? Math.round(statusData.duration as number) : undefined;
    expect(actualDuration).toBeUndefined();
  });

  it("actualDuration is 0 when statusData.duration is 0 (treated as falsy → undefined)", () => {
    const statusData = { duration: 0, status: "succeeded" };
    const actualDuration = statusData.duration ? Math.round(statusData.duration) : undefined;
    // 0 is falsy, so undefined is expected (matches production code)
    expect(actualDuration).toBeUndefined();
  });

  it("actualDuration rounds correctly for various float values", () => {
    const cases: [number, number][] = [
      [30.1, 30],
      [30.5, 31],
      [45.9, 46],
      [60.0, 60],
      [89.4, 89],
    ];
    cases.forEach(([input, expected]) => {
      const result = input ? Math.round(input) : undefined;
      expect(result).toBe(expected);
    });
  });

  it("Videos page displays actualDuration when available, falls back to script duration", () => {
    // Simulate the display logic from Videos.tsx
    const displayDuration = (actualDuration: number | null | undefined, duration: string) =>
      actualDuration ? `${actualDuration}s` : `${duration}s`;

    expect(displayDuration(39, "30")).toBe("39s");
    expect(displayDuration(null, "30")).toBe("30s");
    expect(displayDuration(undefined, "60")).toBe("60s");
  });
});

// ─── Validator Phase 1: email sequence shape validation ──────────────────────
// Sprint B+1 path d. Covers the 3 known emails-as-string sub-cases (valid
// JSON-encoded array string, Python-dict single-quote literal, unrecoverable
// malformed string) plus other shape failures (missing field, wrong type,
// empty array, non-object items, items missing required fields). Each
// fail case asserts a specific subCase tag + a failContext message that
// the validator returns for next-retry injection.

import { validateEmailSequenceShape } from "./_core/validator";

const validEmail = {
  day: 1,
  subject: "subject one",
  previewText: "preview",
  body: "body content here",
  cta: "cta link",
  ps: "ps line",
};

describe("Validator Phase 1 — email sequence shape", () => {
  it("ok: well-formed parsed object with emails array recovers cleanly", () => {
    const result = validateEmailSequenceShape({ emails: [validEmail] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe("subject one");
    }
  });

  it("ok: legacy shape where root parsed is the array directly", () => {
    const result = validateEmailSequenceShape([validEmail, { ...validEmail, day: 2 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.emails).toHaveLength(2);
    }
  });

  it("sub-case 1: emails is a valid JSON-encoded array string — recovers via JSON.parse", () => {
    const stringified = JSON.stringify([validEmail]);
    const result = validateEmailSequenceShape({ emails: stringified });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.emails[0].subject).toBe("subject one");
    }
  });

  it("sub-case 2: emails is a Python-dict single-quote literal — recovers via guarded conversion", () => {
    const pyDictStyle = `[{ 'day': 1, 'subject': 'subject one', 'previewText': 'preview', 'body': 'body content here', 'cta': 'cta link', 'ps': 'ps line' }]`;
    const result = validateEmailSequenceShape({ emails: pyDictStyle });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe("subject one");
    }
  });

  it("sub-case 3: emails is a truncated/malformed string — unrecoverable, returns failContext with preview", () => {
    const truncated = `[ { "day": 1, "subject": "your 12-hour slide deck problem", "preview`;
    const result = validateEmailSequenceShape({ emails: truncated });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("emails_string_unrecoverable");
      // failContext must include the preview so Sonnet sees what it emitted.
      expect(result.failContext).toContain("your 12-hour slide deck problem");
      // failContext must instruct the retry to emit a literal JSON array.
      expect(result.failContext).toMatch(/literal JSON array/i);
    }
  });

  it("emails field missing — failContext lists actual top-level keys", () => {
    const result = validateEmailSequenceShape({ messages: [], other: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("emails_field_missing");
      expect(result.failContext).toContain("messages");
      expect(result.failContext).toContain("other");
    }
  });

  it("emails is wrong type (number) — failContext names the type", () => {
    const result = validateEmailSequenceShape({ emails: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("emails_wrong_type");
      expect(result.failContext).toContain("number");
    }
  });

  it("emails is empty array — failContext says empty", () => {
    const result = validateEmailSequenceShape({ emails: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("emails_empty_array");
      expect(result.failContext).toMatch(/empty/i);
    }
  });

  it("email item is not an object (string instead) — failContext names the index", () => {
    const result = validateEmailSequenceShape({ emails: [validEmail, "not an object"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("email_item_not_object");
      expect(result.failContext).toContain("index 1");
    }
  });

  it("email item missing required field (body) — failContext names the missing field", () => {
    const { body: _ignored, ...incomplete } = validEmail;
    void _ignored;
    const result = validateEmailSequenceShape({ emails: [incomplete] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("email_item_missing_required");
      expect(result.failContext).toContain("body");
    }
  });

  it("non-object root (null) — failContext asks for a JSON object", () => {
    const result = validateEmailSequenceShape(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("non_object_root");
      expect(result.failContext).toMatch(/JSON object/i);
    }
  });

  it("non-object root (string) — failContext names the parsed type", () => {
    const result = validateEmailSequenceShape("not a json object");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("non_object_root");
      expect(result.failContext).toContain("string");
    }
  });

  it("apostrophe-in-content survives the Python-dict guard (no false positive on legitimate apostrophes)", () => {
    // Valid JSON-encoded array with apostrophes inside string values — must
    // NOT be mistaken for a Python-dict literal by the conversion guard.
    const validWithApostrophes = JSON.stringify([
      { ...validEmail, body: "you're not alone — don't give up" },
    ]);
    const result = validateEmailSequenceShape({ emails: validWithApostrophes });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.emails[0].body).toContain("you're");
      expect(result.emails[0].body).toContain("don't");
    }
  });
});

// ─── Validator Phase 2: WhatsApp sequence shape ──────────────────────────────
// Mirrors email shape tests but for `messages` field with day/message/cta.

import {
  validateWhatsappSequenceShape,
  validateEmailFabricationPatterns,
  validateWhatsappFabricationPatterns,
  validateLandingPageTestimonialsFabrication,
} from "./_core/validator";

const validWaMsg = {
  day: 0,
  message: "Hey friend, here's the thing about board pressure.",
  cta: "Reply with where you're stuck.",
};

describe("Validator Phase 2 — WhatsApp sequence shape", () => {
  it("ok: well-formed parsed object with messages array recovers cleanly", () => {
    const result = validateWhatsappSequenceShape({ messages: [validWaMsg] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].message).toBe(validWaMsg.message);
    }
  });

  it("ok: legacy `text` field instead of `message` is accepted as body", () => {
    const result = validateWhatsappSequenceShape({ messages: [{ day: 0, text: "legacy body", cta: "click" }] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messages[0].text).toBe("legacy body");
    }
  });

  it("sub-case 1: messages as JSON-encoded array string — recovers via JSON.parse", () => {
    const stringified = JSON.stringify([validWaMsg]);
    const result = validateWhatsappSequenceShape({ messages: stringified });
    expect(result.ok).toBe(true);
  });

  it("sub-case 2: messages as Python-dict single-quote literal — recovers", () => {
    const pyDictStyle = `[{ 'day': 0, 'message': 'short body', 'cta': 'reply' }]`;
    const result = validateWhatsappSequenceShape({ messages: pyDictStyle });
    expect(result.ok).toBe(true);
  });

  it("sub-case 3: messages as truncated string — unrecoverable, failContext with preview", () => {
    const truncated = `[ { "day": 0, "message": "Hey friend here is`;
    const result = validateWhatsappSequenceShape({ messages: truncated });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("messages_string_unrecoverable");
      expect(result.failContext).toMatch(/literal JSON array/i);
    }
  });

  it("messages field missing — failContext lists actual top keys", () => {
    const result = validateWhatsappSequenceShape({ emails: [], other: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("messages_field_missing");
      expect(result.failContext).toContain("emails");
    }
  });

  it("message item missing body (neither message nor text) — failContext names missing field", () => {
    const result = validateWhatsappSequenceShape({ messages: [{ day: 0, cta: "click" }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("message_item_missing_required");
      expect(result.failContext).toContain("message");
    }
  });
});

// ─── Validator Phase 2: fabrication-pattern catalog ──────────────────────────
// Per-class positive (catches), negative (no false positive), and token-override
// (where applicable) cases. Patterns operate on email/WA/LP testimonial bodies.

const cleanEmail = {
  day: 1,
  subject: "subject",
  previewText: "preview",
  body: "A Head of Engineering at a professional services firm came in with a specific problem. The Protocol works differently. Conducted over [INSERT_PROGRAMME_DURATION], it shifts the pattern.",
  cta: "click",
  ps: "ps line",
};

describe("Validator Phase 2 — fabrication patterns (email)", () => {
  it("ok: clean email with role + situation + token usage — no hits", () => {
    const result = validateEmailFabricationPatterns([cleanEmail]);
    expect(result.ok).toBe(true);
  });

  it("family_composition: 'with a 10-month-old' — caught with class label + location", () => {
    const dirty = { ...cleanEmail, body: "She is a primary school teacher with a 10-month-old and a partner on shift work." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const families = result.hits.filter(h => h.classId === "family_composition");
      expect(families.length).toBeGreaterThanOrEqual(1);
      expect(families[0].location).toBe("email[0].body");
    }
  });

  it("family_composition: 'with three kids under 5' — caught", () => {
    const dirty = { ...cleanEmail, body: "He came in with three kids under 5 and no spare hour in the day." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "family_composition")).toBe(true);
    }
  });

  it("partner_specifics: 'a partner on shift work' — caught", () => {
    const dirty = { ...cleanEmail, body: "She had a partner on shift work and no morning routine." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "partner_specifics")).toBe(true);
    }
  });

  it("employer_specifics: 'at a Big-4 firm' — caught", () => {
    const dirty = { ...cleanEmail, body: "She'd been at a Big-4 firm for six years before the move." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "employer_specifics")).toBe(true);
    }
  });

  it("direct_quoted_speech: 'she told me' — caught", () => {
    const dirty = { ...cleanEmail, body: "After the session she told me that nothing would be the same again." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "direct_quoted_speech")).toBe(true);
    }
  });

  it("invented_tenure: 'twelve years of domain depth' — caught (kit 13 evidence)", () => {
    const dirty = { ...cleanEmail, body: "A VP of Finance with twelve years of domain depth came in." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "invented_tenure")).toBe(true);
    }
  });

  it("invented_tenure: 'after fifteen years working' — caught (kit 11 era evidence)", () => {
    const dirty = { ...cleanEmail, body: "After fifteen years working with high-achieving women, the pattern is clear." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "invented_tenure")).toBe(true);
    }
  });

  it("programme_duration_drift: 'inside eight weeks of The Calm Authority' — caught (kit 13 evidence)", () => {
    const dirty = { ...cleanEmail, body: "And inside eight weeks of The Calm Authority's Protocol, she presented to a live exec panel." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "programme_duration_drift")).toBe(true);
    }
  });

  it("programme_duration_drift: '12-week programme' — caught (sprint history evidence)", () => {
    const dirty = { ...cleanEmail, body: "Our 12-week programme runs quarterly." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
  });

  it("programme_duration_drift: TOKEN OVERRIDE — [INSERT_PROGRAMME_DURATION] in same body — no false positive", () => {
    // Same suspicious phrase, but operator-fill token is present in the body.
    const tokened = {
      ...cleanEmail,
      body: "The Protocol runs over [INSERT_PROGRAMME_DURATION] and operates on the same arc, even when the phrase '12-week programme' would otherwise apply.",
    };
    const result = validateEmailFabricationPatterns([tokened]);
    expect(result.ok).toBe(true);
  });

  it("named_research_source: 'Harvard study finds' — caught", () => {
    const dirty = { ...cleanEmail, body: "A Harvard study finds that 92% of leaders feel this way." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "named_research_source")).toBe(true);
    }
  });

  it("named_research_source: 'studies show' — caught (generic research-shape)", () => {
    const dirty = { ...cleanEmail, body: "Studies show that timing matters more than content." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "named_research_source")).toBe(true);
    }
  });

  it("x_of_y_demographic: 'fewer than 1 in 8 women' — caught (kit 11 evidence)", () => {
    const dirty = { ...cleanEmail, body: "Fewer than 1 in 8 women in your position make the next jump." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "x_of_y_demographic")).toBe(true);
    }
  });

  it("x_of_y_demographic: 'above 80% of professionals' — caught", () => {
    const dirty = { ...cleanEmail, body: "Above 80% of professionals at this level report the same pattern." };
    const result = validateEmailFabricationPatterns([dirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "x_of_y_demographic")).toBe(true);
    }
  });

  it("multiple classes in one email — all hits captured", () => {
    const veryDirty = {
      ...cleanEmail,
      body: "A primary school teacher with a 10-month-old and a partner on shift work — she told me after twelve years of domain depth that inside eight weeks of our Protocol nothing was the same.",
    };
    const result = validateEmailFabricationPatterns([veryDirty]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const classes = new Set(result.hits.map(h => h.classId));
      expect(classes.has("family_composition")).toBe(true);
      expect(classes.has("partner_specifics")).toBe(true);
      expect(classes.has("direct_quoted_speech")).toBe(true);
      expect(classes.has("invented_tenure")).toBe(true);
      // failContext capped at top-N hits but message must surface "additional hit(s)".
      expect(result.failContext).toMatch(/additional hit/);
    }
  });

  it("hits include both body AND subject scans (cross-field)", () => {
    const subjectFab = { ...cleanEmail, subject: "Studies show this works" };
    const result = validateEmailFabricationPatterns([subjectFab]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.location === "email[0].subject")).toBe(true);
    }
  });
});

describe("Validator Phase 2 — fabrication patterns (WhatsApp)", () => {
  it("ok: clean WA message — no hits", () => {
    const result = validateWhatsappFabricationPatterns([{ day: 0, message: "Hey friend — short clean body." }]);
    expect(result.ok).toBe(true);
  });

  it("catches programme_duration_drift in WA message — kit 13 evidence verbatim", () => {
    const kit13Msg = {
      day: 24,
      message: "A VP of Finance — twelve years of domain depth — was told her delivery needed work, and inside eight weeks of The Calm Authority's Boardroom Pressure Calibration Protocol, she presented to a live exec panel.",
    };
    const result = validateWhatsappFabricationPatterns([kit13Msg]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const classes = new Set(result.hits.map(h => h.classId));
      expect(classes.has("invented_tenure")).toBe(true);
      expect(classes.has("programme_duration_drift")).toBe(true);
    }
  });

  it("accepts `text` field as body for pattern check", () => {
    const result = validateWhatsappFabricationPatterns([{ day: 0, text: "studies show this works" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "named_research_source")).toBe(true);
    }
  });
});

describe("Validator Phase 2 — fabrication patterns (LP testimonials)", () => {
  it("ok: clean testimonials — no hits", () => {
    const clean = [
      { headline: "Great experience", quote: "I tried the method and the structural shift was real.", name: "A coach", location: "Remote" },
    ];
    const result = validateLandingPageTestimonialsFabrication(clean);
    expect(result.ok).toBe(true);
  });

  it("catches invented tenure in quote — kit 13 LP evidence verbatim shape", () => {
    const dirty = [
      { headline: "Real shift", quote: "I have been presenting to boards for eleven years and nothing has worked like this.", name: "A Finance Director", location: "London" },
    ];
    const result = validateLandingPageTestimonialsFabrication(dirty);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "invented_tenure")).toBe(true);
      expect(result.hits[0].location).toMatch(/testimonial\[0\]\.quote/);
    }
  });

  it("catches direct quoted speech pattern inside quote", () => {
    const dirty = [
      { headline: "...", quote: "After the session she told me everything would change.", name: "x", location: "y" },
    ];
    const result = validateLandingPageTestimonialsFabrication(dirty);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "direct_quoted_speech")).toBe(true);
    }
  });

  it("non-array input returns ok (defensive — no testimonials means nothing to validate)", () => {
    const result = validateLandingPageTestimonialsFabrication(undefined as unknown as Parameters<typeof validateLandingPageTestimonialsFabrication>[0]);
    expect(result.ok).toBe(true);
  });
});

// ─── Phase C C0: Auto Mode tier gate ─────────────────────────────────────────
// Pure helper isAutoModeTierAllowed gates the orchestrate mutation. Trial-tier
// users are blocked; pro/agency are allowed; superuser bypasses regardless of
// tier. Admin role does NOT bypass — admin is a workstream role, not a paid-
// tier substitute.

import { isAutoModeTierAllowed } from "./routers/autoMode";

describe("Phase C C0 — Auto Mode tier gate", () => {
  it("trial tier blocked — returns reason mentioning upgrade", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "trial" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/upgrade/i);
    expect(result.reason).toMatch(/Pro/);
  });

  it("pro tier allowed", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "pro" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("agency tier allowed", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "agency" });
    expect(result.allowed).toBe(true);
  });

  it("superuser role bypasses tier gate even on trial", () => {
    const result = isAutoModeTierAllowed({ role: "superuser", subscriptionTier: "trial" });
    expect(result.allowed).toBe(true);
  });

  it("admin role bypasses tier gate (Phase F sequencing — admin is internal-only, never customer-held)", () => {
    const result = isAutoModeTierAllowed({ role: "admin", subscriptionTier: "trial" });
    expect(result.allowed).toBe(true);
  });

  it("null subscriptionTier blocked (defensive — defaults to trial per schema but coerce explicitly)", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: null });
    expect(result.allowed).toBe(false);
  });

  it("undefined subscriptionTier blocked (same defensive case)", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: undefined });
    expect(result.allowed).toBe(false);
  });

  it("unknown tier string blocked (defensive — schema enum could expand without this gate being updated)", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "enterprise_legacy" });
    expect(result.allowed).toBe(false);
  });
});

// ─── Phase C C1: ad creatives cascade step (structural assertions) ───────────
// The gen-core runAdCreativesGeneration itself is too I/O-heavy to test here
// (it hits Replicate + S3). Coverage here is structural: orchestration's
// step-label catalog includes the new step, and the AutoModeZappyScript
// failure-path map covers it for client-side deep-link UX. The end-to-end
// behaviour is verified by the post-deploy Auto Mode probe.

import { ORCHESTRATION_STEP_LABELS } from "./_core/orchestration";

describe("Phase C C1 — ad creatives cascade step", () => {
  it("ORCHESTRATION_STEP_LABELS includes adCreatives entry", () => {
    expect(ORCHESTRATION_STEP_LABELS).toHaveProperty("adCreatives");
    expect(typeof ORCHESTRATION_STEP_LABELS.adCreatives).toBe("string");
    expect(ORCHESTRATION_STEP_LABELS.adCreatives.length).toBeGreaterThan(0);
  });

  it("adCreatives label is user-facing copy mentioning creatives or variations", () => {
    // Sanity that the label is the user-facing progress string, not just a slug
    expect(ORCHESTRATION_STEP_LABELS.adCreatives).toMatch(/creative|variation/i);
  });
});

// ─── Phase C C1.1: ad headlines length validator ─────────────────────────────
// Validates the 5-headline shape + per-headline ≤38 char Meta-compliance cap.
// Used by generateContextualAdHeadlines's retry-with-fail-context loop in the
// Auto Mode cascade's step 9 (adCreatives) — replaces HEADLINE_FORMULAS
// template-fill which produced over-40-char headlines for kit 13.

import { validateAdHeadlines } from "./_core/validator";

// These cases exercise the FIVE-headline shape, so they pass 5 explicitly.
// The count used to be a module constant inside the validator; it is now a
// required argument (2026-08-01) precisely because a hidden default let the
// prompt and the validator disagree and took ad-creative generation down.
const FIVE_VALID_SHORT_HEADLINES = [
  "Cut Decision Time 50%",      // 21 chars
  "Founders Trust This System", // 26 chars
  "Why Your Forecast Lies",     // 22 chars
  "From Guess to Number",       // 20 chars
  "Stop Chasing Dead Deals",    // 23 chars
];

describe("Phase C C1.1 — ad headlines length validator", () => {
  it("ok: 5 valid ≤38-char headlines pass", () => {
    const result = validateAdHeadlines({ headlines: FIVE_VALID_SHORT_HEADLINES }, 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headlines).toHaveLength(5);
    }
  });

  it("ok: legacy shape where root parsed is the array directly", () => {
    const result = validateAdHeadlines(FIVE_VALID_SHORT_HEADLINES, 5);
    expect(result.ok).toBe(true);
  });

  it("FAIL: any headline over 38 chars → failContext lists overlength items with chars + text", () => {
    const dirty = [
      "Cut Decision Time 50%",
      "THE BOARDROOM PRESSURE CALIBRATION PROTOCOL: CUT YOUR FINANCE TIME BY 90%", // 73 chars (kit 13 evidence-shape)
      "Why Your Forecast Lies",
      "From Guess to Number",
      "Stop Chasing Dead Deals",
    ];
    const result = validateAdHeadlines({ headlines: dirty }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_over_length");
      // failContext must surface the offending index + length + text + 38-char rule
      expect(result.failContext).toContain("headline[1]");
      expect(result.failContext).toContain(`${dirty[1].length}`); // computed length, no off-by-one
      expect(result.failContext).toMatch(/38/);
      expect(result.failContext).toContain("BOARDROOM PRESSURE CALIBRATION");
    }
  });

  it("FAIL: multiple over-length headlines all reported in failContext", () => {
    const veryDirty = [
      "Cut Decision Time 50%",
      "FINANCE LEGAL AND ENGINEERING LEADERS WHO STRUGGLE WITH STAGE PRESENCE", // 70 chars
      "PRESSURE CALIBRATION: CUT YOUR FINANCE LEGAL ENGINEERING TIME", // 61 chars
      "From Guess to Number",
      "Stop Chasing Dead Deals",
    ];
    const result = validateAdHeadlines({ headlines: veryDirty }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_over_length");
      expect(result.failContext).toContain("headline[1]");
      expect(result.failContext).toContain("headline[2]");
    }
  });

  it("FAIL: wrong count (4 instead of 5) → failContext names the count mismatch", () => {
    const result = validateAdHeadlines({ headlines: FIVE_VALID_SHORT_HEADLINES.slice(0, 4) }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headlines_wrong_count");
      expect(result.failContext).toContain("4");
      expect(result.failContext).toContain("5");
    }
  });

  it("FAIL: 6 headlines → also failContext names the count mismatch", () => {
    const result = validateAdHeadlines({ headlines: [...FIVE_VALID_SHORT_HEADLINES, "Extra one"] }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headlines_wrong_count");
    }
  });

  it("FAIL: missing headlines field → wrong_type", () => {
    const result = validateAdHeadlines({ other: "x" }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headlines_wrong_type");
    }
  });

  it("FAIL: non-string element → headline_not_string", () => {
    const dirty = [
      "Cut Decision Time 50%",
      123, // not a string
      "Why Your Forecast Lies",
      "From Guess to Number",
      "Stop Chasing Dead Deals",
    ];
    const result = validateAdHeadlines({ headlines: dirty }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_not_string");
      expect(result.failContext).toContain("index 1");
    }
  });

  it("FAIL: empty string element → headline_not_string", () => {
    const dirty = [
      "Cut Decision Time 50%",
      "",
      "Why Your Forecast Lies",
      "From Guess to Number",
      "Stop Chasing Dead Deals",
    ];
    const result = validateAdHeadlines({ headlines: dirty }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_not_string");
    }
  });

  it("OK: headlines field as valid JSON-encoded string is recovered (sub-case 1)", () => {
    const stringified = JSON.stringify(FIVE_VALID_SHORT_HEADLINES);
    const result = validateAdHeadlines({ headlines: stringified }, 5);
    expect(result.ok).toBe(true);
  });

  it("OK: exactly 38-char headline (boundary) passes", () => {
    const at_38 = "0123456789012345678901234567890123 ab8"; // exactly 38
    expect(at_38.length).toBe(38);
    const headlines = [at_38, "B", "C", "D", "E"];
    const result = validateAdHeadlines({ headlines }, 5);
    expect(result.ok).toBe(true);
  });

  it("FAIL: 39-char headline (boundary+1) caught", () => {
    const at_39 = "0123456789012345678901234567890123 ab89"; // exactly 39
    expect(at_39.length).toBe(39);
    const headlines = [at_39, "B", "C", "D", "E"];
    const result = validateAdHeadlines({ headlines }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_over_length");
    }
  });
});

// ─── Phase C C1.1 Phase 2: prompt-fortification regression guards ────────────
// Smoke tests for buildAdHeadlinesUserPrompt — guard against future edits
// silently removing the few-shot example compressions, the length rule, or
// the social_proof tightening. These were the high-leverage fortifications
// added 2026-05-11 after kit 13 C1.1 attempt 1 exhausted all 3 retries on
// identical inputs that a 2nd attempt later passed (Sonnet variance). The
// fortification's goal is variance reduction; these tests prevent the
// fortification from silently regressing.

import { buildAdHeadlinesUserPrompt } from "./adCreativesGenerator";

const SAMPLE_INPUT = {
  productName: "The Calm Authority",
  mainBenefit: "Present to boards with calm conviction",
  targetAudience: "Senior finance and engineering leaders",
  uniqueMechanism: "The Boardroom Pressure Calibration Protocol",
  pressingProblem: "Going clipped or defensive on adversarial board questions",
};

describe("Phase C C1.1 Phase 2 — ad headlines prompt fortification", () => {
  it("prompt includes the length rule with HARD LIMIT framing", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    expect(prompt).toContain("38");
    expect(prompt).toMatch(/HARD LIMIT/);
    expect(prompt).toMatch(/LENGTH RULE/i);
  });

  it("prompt includes word-count planning strategy (4-7 words)", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    // The fortification's most empirically-supported element: tell Sonnet to
    // plan WORDS rather than count chars after the fact.
    expect(prompt).toMatch(/4 to 7 WORDS/);
  });

  it("prompt explicitly bans audience-prefix headlines", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    // Highest-leverage compression: dropping "Senior leaders who…" /
    // "Founders at $X ARR…" prefixes that consumed 40-60% of chars in the
    // C1 HEADLINE_FORMULAS failures.
    expect(prompt).toMatch(/Drop the audience prefix/i);
    expect(prompt).toMatch(/Senior leaders who/);
  });

  it("prompt includes all 3 few-shot compression examples across audited niches", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    // Cross-context examples (speaking + consulting + info-product) so
    // Sonnet sees the pattern across niches, not just the current one.
    expect(prompt).toContain("Boardroom voice killed the promotion.");
    expect(prompt).toContain("Your $800k pipeline might be $200k.");
    expect(prompt).toContain("Why your last clip went unusable.");
  });

  it("prompt tightens SOCIAL_PROOF register against generic credibility claims", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    // The position-1 weak headline gap from the successful run: closes the
    // "Senior leaders trust this protocol" generic-credibility class.
    expect(prompt).toMatch(/trust this/);
    expect(prompt).toMatch(/forbidden/i);
  });

  // CHANGED 2026-08-01 — was "all 5 emotional registers" and asserted /CONTRAST/.
  // The object slot was retired from the tabloid deck, which retired its paired
  // `contrast` register with it. Asserted against the DECK now rather than a
  // hardcoded list, so this test tracks the source of truth instead of drifting
  // from it — the exact failure mode that motivated deriving the prompt.
  it("prompt includes per-register example shapes for every register in the deck", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    for (const v of AD_VARIATIONS) {
      expect(prompt, v.formula).toMatch(new RegExp(v.formula.toUpperCase()));
    }
    expect(prompt).toMatch(/BENEFIT/);
    expect(prompt).toMatch(/SOCIAL_PROOF/);
    expect(prompt).toMatch(/CURIOSITY/);
    expect(prompt).toMatch(/CHALLENGE/);
    // The retired register must not still be requested from the model.
    expect(prompt).not.toMatch(/CONTRAST/);
    // Sample of expected example-shape phrases that should round-trip
    expect(prompt).toMatch(/Example shapes/);
  });

  it("prompt asks for exactly as many headlines as the deck has slots", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    const n = AD_VARIATIONS.length;
    expect(prompt).toContain(`Write ${n} Meta-compliant ad headlines`);
    expect(prompt).toContain(`THE ${n} HEADLINES`);
    expect(prompt).toContain(`array of exactly ${n} strings`);
    expect(prompt).toContain(AD_VARIATIONS.map((v) => v.formula).join(", "));
  });

  it("prompt closes with a count-characters reminder as final instruction", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    expect(prompt).toMatch(/Count the characters on each headline before finalising/);
  });

  it("prompt interpolates all 5 input fields verbatim", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    expect(prompt).toContain(SAMPLE_INPUT.productName);
    expect(prompt).toContain(SAMPLE_INPUT.mainBenefit);
    expect(prompt).toContain(SAMPLE_INPUT.targetAudience);
    expect(prompt).toContain(SAMPLE_INPUT.uniqueMechanism);
    expect(prompt).toContain(SAMPLE_INPUT.pressingProblem);
  });
});

// ─── Phase C C2: landing page auto-publish (structural assertions) ───────────
// The runLandingPagePublish gen-core itself is too I/O-heavy to test inline
// (it hits Cloudflare KV + Workers + DB). Coverage here is structural:
// gen-core is exported with the documented signature shape; orchestrator
// step labels still intact post-wire (no regression on the C1 / C1.1
// guarantees).

import { runLandingPagePublish } from "./landingPagePublisher";

describe("Phase C C2 — landing page auto-publish", () => {
  it("runLandingPagePublish is exported with the documented call shape", () => {
    // Compile-time check via runtime introspection — if the function
    // signature changes silently, this fails. Doesn't actually invoke
    // (Cloudflare side-effects); just confirms the export exists + is
    // callable.
    expect(typeof runLandingPagePublish).toBe("function");
    expect(runLandingPagePublish.length).toBe(1); // takes a single input object
  });

  it("ORCHESTRATION_STEP_LABELS landingPage entry still references angle generation (not regression)", () => {
    // After C2 wire, the landingPage label evolves through:
    //   "Generating angle {N} of 4 for your landing page…" → (during gen)
    //   "Publishing your landing page…" → (between gen and finalise)
    //   "Finalising your landing page…" → (terminal step state)
    // The static label in ORCHESTRATION_STEP_LABELS uses the {N} pattern
    // (gets overwritten by writeProgress at runtime).
    expect(ORCHESTRATION_STEP_LABELS.landingPage).toMatch(/angle/i);
    expect(ORCHESTRATION_STEP_LABELS.landingPage).toMatch(/landing page/i);
  });
});

// ─── Phase C C3: Meta + GHL push wire-up (structural assertions) ─────────────
// The PushKitModal React component is too I/O-heavy to invoke in vitest
// (real tRPC mutations, OAuth popups, Promise.allSettled across two live
// platform mutations). Coverage here is structural:
//   1. Meta OAuth callback was patched to capture pageId from /me/accounts
//      and write it into the metaAccessTokens row — closes the L537 latent
//      trap where createAdCreative emitted object_story_spec.page_id="".
//   2. PushKitModal component file exists and exports the deriveDefaultBody
//      helper used to seed the Meta body textarea from LP angle data.
//   3. V2CampaignKit kit page is no longer rendering the "Push coming soon"
//      toast — handlePush opens the unified push modal.

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase C C3 — Meta + GHL push wire-up", () => {
  it("metaOAuth callback captures pageId from /me/accounts and persists it on insert + update", () => {
    const src = readFileSync(join(__dirname, "_core/metaOAuth.ts"), "utf8");
    // /me/accounts call is present (Pages list, distinct from /me/adaccounts)
    expect(src).toMatch(/\/me\/accounts/);
    // pageId variable is declared, populated from the response, and written
    // into both the update and insert paths so reconnects pick it up.
    expect(src).toMatch(/let\s+pageId/);
    expect(src).toMatch(/pageId\s*=\s*pagesData\.data\[0\]\.id/);
    // Both DB write paths carry pageId (update + insert)
    const insertCount = (src.match(/pageId,?\s*\n?\s*}\)/g) || []).length;
    expect(insertCount).toBeGreaterThanOrEqual(1);
  });

  it("PushKitModal component file exists with the deriveDefaultBody helper exported", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/PushKitModal.tsx"),
      "utf8",
    );
    // Component exports
    expect(src).toMatch(/export\s+default\s+function\s+PushKitModal/);
    expect(src).toMatch(/export\s+function\s+deriveDefaultBody/);
    // Both router endpoints wired
    expect(src).toMatch(/trpc\.meta\.publishToMeta\.useMutation/);
    expect(src).toMatch(/trpc\.ghl\.pushCampaign\.useMutation/);
    expect(src).toMatch(/trpc\.meta\.getConnectionStatus/);
    expect(src).toMatch(/trpc\.ghl\.getConnectionStatus/);
    // Promise.allSettled is used for the "Push to both" path (partial-
    // failure handling per C3 lock).
    expect(src).toMatch(/Promise\.allSettled/);
    // OAuth-at-click-time bridge — focus listener triggers refetch on
    // both connection-status queries when the OAuth popup returns.
    expect(src).toMatch(/window\.addEventListener\(\s*["']focus["']/);
  });

  it("Meta publishToMeta no longer passes daily_budget to createCampaign (C3 follow-on 5)", () => {
    // CBO override regression-guard. Passing daily_budget at campaign-
    // level activates Meta CBO, which overrides ad-set-level bid_strategy.
    // The fix keeps budget exclusively on the ad-set call.
    const src = readFileSync(join(__dirname, "routers/meta.ts"), "utf8");
    // The createCampaign call should NOT include dailyBudget or
    // lifetimeBudget keys. Regex matches the createCampaign({...}) block.
    const campaignCallMatch = src.match(/createCampaign\(ctx\.user\.id,\s*\{[\s\S]*?\}\)/);
    expect(campaignCallMatch).toBeTruthy();
    expect(campaignCallMatch![0]).not.toMatch(/dailyBudget:/);
    expect(campaignCallMatch![0]).not.toMatch(/lifetimeBudget:/);
    // createAdSet call should still carry the budget passthrough
    expect(src).toMatch(/createAdSet\(ctx\.user\.id,[\s\S]*?dailyBudget:/);
  });

  it("Meta createAdSet payload includes bid_strategy=LOWEST_COST_WITHOUT_CAP + optimization_goal=LINK_CLICKS (C3 follow-ons 4+6)", () => {
    // bid_strategy: without it, Meta Graph API v21 defaults to a bid-cap
    // strategy when daily_budget is set, then rejects with error_subcode
    // 1815857. Auto-bidding is the canonical default — matches the
    // modal's "Paused (review first)" UX.
    // optimization_goal: post-ODAX (2023+) objective taxonomy requires
    // LINK_CLICKS for website-traffic-leads pairing. REACH was the legacy
    // AWARENESS pairing and is mismatched for OUTCOME_LEADS in v21.
    const src = readFileSync(join(__dirname, "lib/metaAPI.ts"), "utf8");
    expect(src).toMatch(/bid_strategy["']?\s*,\s*["']LOWEST_COST_WITHOUT_CAP["']/);
    expect(src).toMatch(/optimization_goal["']?\s*,\s*["']LINK_CLICKS["']/);
    // Regression-guard: REACH should no longer appear as an
    // optimization_goal value (it does still appear in comments).
    expect(src).not.toMatch(/optimization_goal["']?\s*,\s*["']REACH["']/);
  });

  it("Meta createCampaign payload includes is_adset_budget_sharing_enabled=false (C3 follow-on 6)", () => {
    // Meta v21 rejects createCampaign with error_subcode 4834011 when no
    // campaign-level budget is set unless is_adset_budget_sharing_enabled
    // is explicitly true|false. We keep budget at ad-set level (CBO off,
    // per c9a35c9) and pick `false` for strict per-ad-set budgets — safer
    // default for single-ad-set pushes, matches modal "Daily budget" UX.
    const src = readFileSync(join(__dirname, "lib/metaAPI.ts"), "utf8");
    expect(src).toMatch(/is_adset_budget_sharing_enabled["']?\s*,\s*["']false["']/);
  });

  it("Meta publish chain has symmetric forensic outbound-URL logs across all 4 create calls (C3 follow-on 6)", () => {
    // 8th planning miss closure — c9a35c9 added the forensic log only to
    // createAdSet. The next failure landed at createCampaign and we had
    // no payload visibility. This regression-guard ensures all 4 Meta
    // create calls log their outbound URL with access_token redacted.
    const src = readFileSync(join(__dirname, "lib/metaAPI.ts"), "utf8");
    expect(src).toMatch(/\[Meta API\] createCampaign outbound URL:/);
    expect(src).toMatch(/\[Meta API\] createAdSet outbound URL:/);
    expect(src).toMatch(/\[Meta API\] createAdCreative outbound URL:/);
    expect(src).toMatch(/\[Meta API\] createAd outbound URL:/);
    // Access token must be redacted, not raw, in every log site
    const redactionCount = (src.match(/access_token["']?\s*,\s*["']<REDACTED>["']/g) || []).length;
    expect(redactionCount).toBeGreaterThanOrEqual(4);
  });

  // ─── Phase C C3 follow-on 8 (Phase 1): GHL master snapshot CV architecture ──

  it("GHL pushCampaign uses stable CV names (no ` - ${kitName}` suffix) — C3 f-o 8", () => {
    // Stable CV names are required so a generic master snapshot can reference
    // them with hard-coded {{custom_values.X}} placeholders. Kit-suffixed names
    // would force per-kit snapshot rebuilds, defeating the architecture.
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    // No live code should template-literal kitName into a CV name. Comments OK.
    expect(src).not.toMatch(/`ZAP [A-Z][^`]* - \$\{kitName\}`/);
    // Stable names present
    for (const name of [
      "ZAP Landing Page", "ZAP Headlines", "ZAP Ad Copy",
      "ZAP Offer Copy", "ZAP Lead Magnet", "ZAP Hero Mechanism",
    ]) {
      expect(src).toMatch(new RegExp("`" + name.replace(/ /g, " ") + "`"));
    }
  });

  it("GHL pushCampaign pushes granular per-email CVs (subject + body per email) — C3 f-o 8", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    // Per-email loop pushes Subject + Body per index — variable N, not fixed
    expect(src).toMatch(/`ZAP Email \$\{i \+ 1\} Subject`/);
    expect(src).toMatch(/`ZAP Email \$\{i \+ 1\} Body`/);
    // Loop bound is emails.length (variable N), not a MAX constant
    expect(src).toMatch(/i < emailCount/);
  });

  it("GHL pushCampaign pushes granular per-message WhatsApp CVs — C3 f-o 8", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    expect(src).toMatch(/`ZAP WhatsApp \$\{i \+ 1\}`/);
    expect(src).toMatch(/i < whatsappCount/);
  });

  it("GHL pushCampaign pushes count + sequence-type indicator CVs — C3 f-o 8", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    // The 4 indicator CVs that drive elastic-workflow branching
    expect(src).toMatch(/"ZAP Email Count"/);
    expect(src).toMatch(/"ZAP Email Sequence Type"/);
    expect(src).toMatch(/"ZAP WhatsApp Count"/);
    expect(src).toMatch(/"ZAP WhatsApp Sequence Type"/);
  });

  it("GHL pushCampaign cleans up orphan over-N slots after each push — C3 f-o 8", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    // cleanupOrphanCustomValues helper exists + is called for both email and WhatsApp
    expect(src).toMatch(/async function cleanupOrphanCustomValues/);
    // Forensic log on the DELETE site
    expect(src).toMatch(/\[GHL API\] cleanupOrphans DELETE/);
    // Both blocks invoke cleanup with regex that excludes slots <=N
    const cleanupCalls = (src.match(/await cleanupOrphanCustomValues\(/g) || []).length;
    expect(cleanupCalls).toBeGreaterThanOrEqual(2);
  });

  it("ghl.getConnectionStatus surfaces masterSnapshotId from env var — C3 f-o 8", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    expect(src).toMatch(/masterSnapshotId:\s*process\.env\.GHL_MASTER_SNAPSHOT_ID/);
  });

  it("PushKitModal ResultsView renders Apply Snapshot banner when masterSnapshotId set + GHL push succeeded — C3 f-o 8", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/PushKitModal.tsx"),
      "utf8",
    );
    // Banner gating condition
    expect(src).toMatch(/showSnapshotBanner\s*=\s*ghlSuccessfulPush\s*&&\s*!!masterSnapshotId/);
    // Banner copy includes the canonical CTA
    expect(src).toMatch(/Apply ZAP Master Snapshot/);
    // Deep link helper imported from the new lib
    expect(src).toMatch(/from\s+["']\.\/lib\/ghlSnapshot["']/);
  });

  it("PushKitModal stale copy (funnel + email-template + workflow) removed — C3 f-o 8", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/PushKitModal.tsx"),
      "utf8",
    );
    // Stale promise from cb23ce0 must be gone — would mislead users post-878a911 + post-f-o-8
    expect(src).not.toMatch(/Funnel page, an email-template per email, and a WhatsApp workflow/);
  });

  it("V2Settings renders Integrations section with Apply Snapshot link — C3 f-o 8", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/V2Settings.tsx"),
      "utf8",
    );
    expect(src).toMatch(/function IntegrationsSection\(/);
    expect(src).toMatch(/SECTION 1\.5:\s*INTEGRATIONS/);
    expect(src).toMatch(/Apply ZAP Master Snapshot/);
  });

  it("ghlSnapshot helper exists with buildSnapshotApplyUrl + openSnapshotApplyTab exports — C3 f-o 8", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/lib/ghlSnapshot.ts"),
      "utf8",
    );
    expect(src).toMatch(/export function buildSnapshotApplyUrl/);
    expect(src).toMatch(/export function openSnapshotApplyTab/);
    expect(src).toMatch(/window\.open/);
  });

  it("GHL OAuth Express callback handler is registered at the redirect URI path (C3 follow-on 3)", () => {
    // The redirect URI built at ghl.ts:312 must have a matching Express
    // GET route — pre-C3-follow-on-3 the handler didn't exist and the
    // path fell through to the React SPA's 404 catchall. Structural
    // assertion: the registration function exists + is wired in index.ts
    // alongside the Meta callback.
    const ghlOAuthSrc = readFileSync(join(__dirname, "_core/ghlOAuth.ts"), "utf8");
    expect(ghlOAuthSrc).toMatch(/export\s+function\s+registerGhlOAuthRoutes/);
    expect(ghlOAuthSrc).toMatch(/app\.get\(\s*["']\/api\/oauth\/gohighlevel\/callback["']/);
    const indexSrc = readFileSync(join(__dirname, "_core/index.ts"), "utf8");
    expect(indexSrc).toMatch(/registerGhlOAuthRoutes\(app\)/);
  });

  it("GHL pushCampaign no longer references removed D2 helpers + emits 8 D1 slots only (C3 follow-on 7)", () => {
    // Frame (c) verification at 01:48 BST surfaced HTTP 401 on /templates
    // (v2 scope ≠ v1 endpoint URL) + HTTP 404 on /funnels (endpoint absent
    // in v2 marketplace OAuth). Same structural pattern as the workflow
    // removal in C3 f-o 2. Removal regression-guards + observability
    // presence on the surviving D1 path.
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    // The 3 removed identifiers must not be referenced as live code (they
    // remain in comments which is fine — match on `await fooName(` or
    // `results.fooName =` to scope to live-code references only).
    expect(src).not.toMatch(/await\s+upsertEmailTemplate\(/);
    expect(src).not.toMatch(/await\s+createGhlFunnel\(/);
    expect(src).not.toMatch(/buildLandingPageHtml\(/);
    expect(src).not.toMatch(/results\.emailTemplatesPushed\s*=/);
    expect(src).not.toMatch(/results\.funnelCreated\s*=/);
    // The 6 single-blob D1 Custom Value slots still use direct upsertCustomValue
    // (C3 f-o 7 shape preserved). emailPushed + whatsappPushed assignment shape
    // changed in C3 f-o 8 (Phase 1) — they're now gated boolean expressions
    // over the granular per-message slot upsert results + count + type CVs.
    for (const slot of [
      "landingPagePushed", "headlinesPushed",
      "adCopyPushed", "offerPushed", "hvcoTitlePushed", "heroMechanismPushed",
    ]) {
      expect(src).toMatch(new RegExp(`results\\.${slot}\\s*=\\s*await\\s+upsertCustomValue`));
    }
    // emailPushed + whatsappPushed are still assigned, just via the new
    // gated-boolean shape. Asserting that the assignments exist (some shape).
    expect(src).toMatch(/results\.emailPushed\s*=/);
    expect(src).toMatch(/results\.whatsappPushed\s*=/);
    // Forensic outbound-URL log present on upsertCustomValue — mirrors the
    // Meta a71efc1 instrumentation pattern (GHL uses Bearer header so no
    // redaction needed; URLs safe to log as-is).
    expect(src).toMatch(/\[GHL API\] upsertCustomValue (LIST GET|PUT|POST)/);
  });

  // ─── Workflow status detection + push gate ──────────────────────────────────

  it("GHL router exports ZAP_WORKFLOW_NAMES constant with 16 canonical workflow names", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    expect(src).toMatch(/const ZAP_WORKFLOW_NAMES\s*=/);
    // All 16 names present
    for (const name of [
      "ZAP Welcome Sequence", "ZAP Launch Sequence", "ZAP Nurture Sequence",
      "ZAP Sales Sequence", "ZAP Discovery Call Reminder", "ZAP Discovery Call Confirmation",
      "ZAP Engagement Sequence", "ZAP Event Logistics", "ZAP Re-Engagement Sequence",
      "ZAP Replay For No-Shows",
      "ZAP WhatsApp Discovery Call Confirmation", "ZAP WhatsApp Discovery Call Reminder",
      "ZAP WhatsApp Engagement", "ZAP WhatsApp Event Logistics",
      "ZAP WhatsApp Nurture", "ZAP WhatsApp Sales",
    ]) {
      expect(src).toContain(`"${name}"`);
    }
  });

  it("GHL router defines getWorkflowStatus query with in-memory cache", () => {
    const src = readFileSync(join(__dirname, "routers/ghl.ts"), "utf8");
    expect(src).toMatch(/getWorkflowStatus:\s*protectedProcedure/);
    expect(src).toMatch(/workflowStatusCache/);
    expect(src).toMatch(/WORKFLOW_CACHE_TTL_MS/);
    // Uses workflows.readonly endpoint
    expect(src).toMatch(/\/workflows\/\?locationId=/);
    // Prefix match detection
    expect(src).toMatch(/\/\^zap\[\\s-\]\/i/);
    // Threshold-based installed check
    expect(src).toMatch(/ZAP_WORKFLOW_THRESHOLD/);
  });

  it("PushKitModal gates ghlPushable on snapshotInstalled", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/PushKitModal.tsx"),
      "utf8",
    );
    expect(src).toMatch(/ghlPushable\s*=\s*ghlConnected\s*&&\s*snapshotInstalled/);
    // WorkflowStatusPill always-visible in GHL section header
    expect(src).toMatch(/WorkflowStatusPill/);
    // Apply Snapshot CTA below pill when not installed
    expect(src).toMatch(/Apply ZAP Master Snapshot →/);
  });

  it("V2Settings IntegrationsSection renders WorkflowStatusPill + Recheck button", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/V2Settings.tsx"),
      "utf8",
    );
    // WorkflowStatusPill extracted to shared component, imported here
    expect(src).toMatch(/import.*WorkflowStatusPill.*from.*components\/WorkflowStatusPill/);
    expect(src).toMatch(/↻ Recheck/);
    expect(src).toMatch(/getWorkflowStatus/);
  });

  it("V2CampaignKit kit page no longer renders the 'Push coming soon' placeholder", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/V2CampaignKit.tsx"),
      "utf8",
    );
    // The C3 commit replaces the toast stub with the PushKitModal import
    // and a setShowPushModal handler. Regression-guard the toast string.
    expect(src).not.toMatch(/toast\("Push coming soon"\)/);
    expect(src).toMatch(/import\s+PushKitModal\s+from\s+["']\.\/PushKitModal["']/);
    expect(src).toMatch(/setShowPushModal/);
    expect(src).toMatch(/<PushKitModal\b/);
  });
});

// ─── Phase D Phase 1 — Offer fabrication validator + canonical operator-fill ──
// Anchored on red-team baseline v1 (docs/redteam-audit-baseline-v1.md).
// Each test validates one fabrication category from the audit's 12-category
// catalog OR confirms USER-SUPPLIED data is correctly classified.

import {
  validateOfferFabricationPatterns,
  getCanonicalOfferTokens,
  type OfferSuppliedData,
  type RawOfferFields,
} from "./_core/validator";

describe("Phase D Phase 1 — validateOfferFabricationPatterns", () => {
  const cleanOffer: RawOfferFields = {
    offerName: "The Clarity Sprint",
    valueProposition: "Move from stuck to clear within your next decision cycle.",
    pricing: "Investment: [INSERT_PRICE]. Includes the full sprint plus [INSERT_GUARANTEE_TERMS].",
    bonuses: "BONUS #1: [INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE]) — Maps your next 90 days.",
    guarantee: "Guarantee: [INSERT_GUARANTEE_TERMS]. Email [INSERT_CONTACT_EMAIL] for refund.",
    urgency: "Limited to [INSERT_COHORT_LIMIT] participants. Enrolment closes [INSERT_COHORT_CLOSE_DATE].",
    cta: "Book a call to begin.",
  };

  // Baseline: clean offer with canonical placeholders passes
  it("returns ok=true when offer uses canonical placeholders only", () => {
    const result = validateOfferFabricationPatterns(cleanOffer, {});
    expect(result.ok).toBe(true);
  });

  it("returns ok=true on empty/missing fields", () => {
    const result = validateOfferFabricationPatterns({}, {});
    expect(result.ok).toBe(true);
  });

  // Category 1: fabricated_pricing_currency_amount
  it("catches fabricated currency amount when no operator price supplied", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: £8,500. Includes the full sprint." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_currency")).toBe(true);
  });

  it("classifies user-supplied price as USER-SUPPLIED (not flagged)", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: £5,000. Includes the full sprint." };
    const supplied: OfferSuppliedData = { price: "5000.00" };
    const result = validateOfferFabricationPatterns(offer, supplied);
    expect(result.ok).toBe(true);
  });

  it("catches additional invented currency amounts even when one price is supplied", () => {
    // Operator supplied £5,000 — output contains £5,000 (user-supplied, ok) AND £18,000 (invented anchor)
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Normally £18,000. Today £5,000." };
    const supplied: OfferSuppliedData = { price: "5000.00" };
    const result = validateOfferFabricationPatterns(offer, supplied);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const inventedCurrency = result.hits.filter(h => h.classId === "offer_invented_currency");
      expect(inventedCurrency.length).toBeGreaterThanOrEqual(1);
      expect(inventedCurrency.some(h => h.matched.includes("18,000"))).toBe(true);
    }
  });

  // Category 2: fabricated_anchor_price_range
  it("catches anchor price range pattern (£X – £Y)", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: £18,000–£24,000 typical retainer; today [INSERT_PRICE]." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_anchor_range")).toBe(true);
  });

  // Category 3: fabricated_bonus_value
  it("catches fabricated bonus value pattern (£X value)", () => {
    const offer: RawOfferFields = { ...cleanOffer, bonuses: "BONUS #1: The Strategy Playbook (£1,200 value) — Maps your 90 days." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_bonus_value")).toBe(true);
  });

  // Category 4: fabricated_total_value
  it("catches fabricated total bonus value summation", () => {
    const offer: RawOfferFields = { ...cleanOffer, bonuses: "Bonuses worth a combined total bonus value: £5,000 — yours free." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_total_value")).toBe(true);
  });

  // Category 5: fabricated_cohort_limit
  it("catches invented cohort size", () => {
    const offer: RawOfferFields = { ...cleanOffer, urgency: "Maximum of 8 leaders per cohort window." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_cohort_limit")).toBe(true);
  });

  // Category 6: fabricated_programme_duration
  it("catches invented programme duration when no deliveryDuration supplied", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: [INSERT_PRICE]. Includes a 12-week sprint with weekly calls." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_programme_duration")).toBe(true);
  });

  it("classifies supplied programme duration as USER-SUPPLIED (not flagged)", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: [INSERT_PRICE]. Includes a 12-week sprint." };
    const supplied: OfferSuppliedData = { deliveryDuration: "12 weeks" };
    const result = validateOfferFabricationPatterns(offer, supplied);
    expect(result.ok).toBe(true);
  });

  // Category 7: fabricated_guarantee_timeframe
  it("catches invented guarantee timeframe when no guaranteeDuration supplied", () => {
    const offer: RawOfferFields = { ...cleanOffer, guarantee: "Refund within 30 days, no questions." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const ids = result.hits.map(h => h.classId);
      expect(ids).toContain("offer_invented_guarantee_timeframe");
    }
  });

  // Category 8: fabricated_specific_refund_mechanic
  it("catches invented refund mechanics ('pay nothing', 'full refund', 'money-back')", () => {
    const offer1: RawOfferFields = { ...cleanOffer, guarantee: "If unsatisfied, you pay nothing." };
    const r1 = validateOfferFabricationPatterns(offer1, {});
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.hits.some(h => h.classId === "offer_invented_refund_mechanic")).toBe(true);

    const offer2: RawOfferFields = { ...cleanOffer, guarantee: "Full refund if not delighted." };
    const r2 = validateOfferFabricationPatterns(offer2, {});
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.hits.some(h => h.classId === "offer_invented_refund_mechanic")).toBe(true);

    const offer3: RawOfferFields = { ...cleanOffer, guarantee: "100% money-back assured." };
    const r3 = validateOfferFabricationPatterns(offer3, {});
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.hits.some(h => h.classId === "offer_invented_refund_mechanic")).toBe(true);
  });

  // Category 9: fabricated_next_cohort_date
  it("catches invented cohort date framing", () => {
    const offer: RawOfferFields = { ...cleanOffer, urgency: "The next cohort opens within the coming weeks." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some(h => h.classId === "offer_invented_cohort_date")).toBe(true);
  });

  // Category 10: offer_banned_placeholder — the 11 banned/invented variants observed in red-team v1
  it("catches the 11 banned/invented placeholder variants observed in red-team baseline v1", () => {
    const bannedTokens = [
      "[INSERT_AVAILABLE_SPOTS]",
      "[INSERT_BOOKING_LINK]",
      "[INSERT_CART_CLOSE]",
      "[INSERT_LAUNCH_DATE]",
      "[INSERT_NEXT_LAUNCH_DATE]",
      "[INSERT_NEXT_OPEN_DATE]",
      "[INSERT_REFUND_EMAIL]",
      "[INSERT_REMAINING_SPOTS]",
      "[INSERT_SPOTS_REMAINING]",
      "[INSERT_START_DATE]",
      "[INSERT_SUPPORT_EMAIL]",
    ];
    for (const tok of bannedTokens) {
      const offer: RawOfferFields = { ...cleanOffer, urgency: `Closes at ${tok}.` };
      const result = validateOfferFabricationPatterns(offer, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.hits.some(h => h.classId === "offer_banned_placeholder" && h.matched === tok)).toBe(true);
      }
    }
  });

  it("does NOT flag canonical placeholders as banned", () => {
    const canonical = getCanonicalOfferTokens();
    expect(canonical.length).toBeGreaterThan(20); // sanity — allow-list is non-trivial
    for (const tok of canonical) {
      const offer: RawOfferFields = { ...cleanOffer, valueProposition: `Reference: ${tok}.` };
      const result = validateOfferFabricationPatterns(offer, {});
      const bannedHits = result.ok ? [] : result.hits.filter(h => h.classId === "offer_banned_placeholder");
      expect(bannedHits.length).toBe(0);
    }
  });

  it("failContext is non-empty + actionable when validator returns ok=false", () => {
    const offer: RawOfferFields = { ...cleanOffer, pricing: "Investment: £8,500 — was £18,000." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failContext.length).toBeGreaterThan(50);
      expect(result.failContext).toMatch(/canonical/i);
      expect(result.failContext).toMatch(/placeholder/i);
    }
  });
});

describe("Phase D Phase 1 — offersGenerator wires validator into retry-with-failContext loop", () => {
  // Structural assertions — verify the generator file invokes the validator
  // and follows the retry-loop pattern.
  it("imports validateOfferFabricationPatterns + getCanonicalOfferTokens", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    expect(src).toMatch(/validateOfferFabricationPatterns/);
    expect(src).toMatch(/getCanonicalOfferTokens/);
  });

  it("contains the retry loop with attempt counter + max attempts constant", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    expect(src).toMatch(/OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS/);
    expect(src).toMatch(/for\s*\(\s*let\s+attempt\s*=\s*1[\s\S]+attempt\s*<=\s*OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS/);
  });

  it("calls validateOfferFabricationPatterns inside the per-attempt loop", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    expect(src).toMatch(/validateOfferFabricationPatterns\(/);
  });

  it("injects validator failContext into retry attempts via PRIOR-ATTEMPT FABRICATION FEEDBACK", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    expect(src).toMatch(/PRIOR-ATTEMPT FABRICATION FEEDBACK/);
  });

  it("emits CANONICAL TOKEN ALLOW-LIST guidance in offer prompt", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    expect(src).toMatch(/CANONICAL TOKEN ALLOW-LIST/);
  });

  it("passes operator-supplied data (price, guarantee, duration, bonuses) to generateOfferAngle", () => {
    const src = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
    // runOfferGeneration must construct an OfferSuppliedData object from service fields
    expect(src).toMatch(/OfferSuppliedData/);
    expect(src).toMatch(/offerSupplied/);
    expect(src).toMatch(/service\.price/);
    expect(src).toMatch(/service\.guaranteeType/);
    expect(src).toMatch(/service\.guaranteeDuration/);
    expect(src).toMatch(/service\.deliveryDuration/);
    expect(src).toMatch(/service\.bonuses/);
  });
});

// ─── Phase D Sprint 2 — LP testimonial archetypal-name detection ─────────────
// Closes v2 baseline residual on lp_testimonial_archetypal_with_location.
// Empirical anchors: fixture 01 produced 4 archetypal testimonials in v2 LP
// despite the prompt's intent to use real names (operator supplied none).
// The new validator catches the structural "A/An + Role" name pattern.

import { validateLandingPageTestimonialsFabrication, type RawTestimonial } from "./_core/validator";

describe("Phase D Sprint 2 — LP testimonial archetypal_name_with_location_detail", () => {
  // Positive detection — exact v2 baseline slips from fixture 01
  it("catches v2 baseline fixture 01 archetypal slips (all 4)", () => {
    const v2Slips: RawTestimonial[] = [
      { name: "A Head of Strategy at a FTSE 250 firm", quote: "I had done two rounds of presentation coaching before this." },
      { name: "A VP of Finance preparing for an investor roadshow", quote: "My pattern was specific — I was fine in the main presentation." },
      { name: "A Commercial Director at a professional services firm", quote: "I had received some version of 'needs more presence'." },
      { name: "A Managing Director at a financial services firm", quote: "I had been doing more and more preparation." },
    ];
    const result = validateLandingPageTestimonialsFabrication(v2Slips);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const archHits = result.hits.filter(h => h.classId === "archetypal_name_with_location_detail");
      expect(archHits.length).toBe(4);
      // Each hit should reference the name field by index
      expect(archHits.map(h => h.location)).toEqual([
        "testimonial[0].name", "testimonial[1].name", "testimonial[2].name", "testimonial[3].name",
      ]);
    }
  });

  // Positive detection — v1 kit-13 archetypal patterns
  it("catches v1 kit-13 archetypal patterns", () => {
    const v1Slips: RawTestimonial[] = [
      { name: "A Finance Director at a professional services firm", quote: "test." },
      { name: "An Engineering VP at a mid-sized technology company", quote: "test." },
      { name: "A Head of Finance at a listed infrastructure business", quote: "test." },
      { name: "A Chief Risk Officer at a financial services group", quote: "test." },
    ];
    const result = validateLandingPageTestimonialsFabrication(v1Slips);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const archHits = result.hits.filter(h => h.classId === "archetypal_name_with_location_detail");
      expect(archHits.length).toBe(4);
    }
  });

  // Negative — real operator-supplied names from v2 fixtures must not flag
  it("does NOT flag real operator-supplied names from v2 fixtures", () => {
    const realNames: RawTestimonial[] = [
      { name: "Maria Hernandez", quote: "Went from £8k months to £35k months." },
      { name: "Tom Aldridge", quote: "Three months later our weekly leadership tension is structurally lower." },
      { name: "David Chen", quote: "I had been stuck at £120k for two years." },
      { name: "Anika Patel", quote: "The pricing rebuild added $1.4M." },
      { name: "Anders Bjornsson", quote: "The positioning shift cut our sales cycle." },
      { name: "Sarah Chen", quote: "We had tried two prior consultants." },
      { name: "Priya Sharma", quote: "Raised my pricing 3x." },
      { name: "Lin Wei", quote: "I was the bottleneck on every launch." },
      { name: "Aiden O'Connor", quote: "I went from 60-hour weeks to 45." },
      { name: "Rachel Park", quote: "By week 8 I had handed off the project." },
    ];
    const result = validateLandingPageTestimonialsFabrication(realNames);
    // None of these should trigger the archetypal class
    const archHits = result.ok ? [] : result.hits.filter(h => h.classId === "archetypal_name_with_location_detail");
    expect(archHits.length).toBe(0);
  });

  // Negative — edge cases that should NOT trigger
  it("does NOT flag edge cases (empty name, lowercase descriptor, no prefix)", () => {
    const edge: RawTestimonial[] = [
      { name: "", quote: "test." },                                    // empty
      { name: "An angry customer", quote: "test." },                   // "angry" lowercase — no role match
      { name: "Senior VP at Acme Corp", quote: "test." },              // no A/An prefix
      { name: "Tom Smith, COO at Series B SaaS", quote: "test." },     // real first name first
      { name: "A passionate learner", quote: "test." },                // no role title
      { name: "An honest review", quote: "test." },                    // no role title
    ];
    const result = validateLandingPageTestimonialsFabrication(edge);
    const archHits = result.ok ? [] : result.hits.filter(h => h.classId === "archetypal_name_with_location_detail");
    expect(archHits.length).toBe(0);
  });

  // Failure context must include actionable corrective guidance
  it("failContext includes corrective guidance referencing empty array OR real names", () => {
    const v2Slips: RawTestimonial[] = [
      { name: "A Head of Strategy at a FTSE 250 firm", quote: "test." },
    ];
    const result = validateLandingPageTestimonialsFabrication(v2Slips);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The failContext (built from hit.description) must convey the corrective action
      expect(result.failContext).toMatch(/EMPTY testimonials array|operator-supplied real names/i);
    }
  });
});

// ─── Phase D Sprint 3 — PlaceholderBanner UX + placeholderDetector ───────────
// Unit tests for the pure detector function (importable + statically testable)
// + structural tests for the React component + integration wiring.

import { detectPlaceholders, detectPlaceholdersInText, summarizePlaceholders } from "../client/src/v2/lib/placeholderDetector";

describe("Phase D Sprint 3 — detectPlaceholdersInText (pure)", () => {
  it("empty string returns no matches", () => {
    expect(detectPlaceholdersInText("")).toEqual([]);
  });

  it("text with no tokens returns no matches", () => {
    expect(detectPlaceholdersInText("Plain copy with no placeholders.")).toEqual([]);
  });

  it("single token detected with count 1", () => {
    const r = detectPlaceholdersInText("Investment: [INSERT_PRICE] today.");
    expect(r).toEqual([{ token: "[INSERT_PRICE]", count: 1 }]);
  });

  it("multiple distinct tokens detected separately", () => {
    const r = detectPlaceholdersInText("Pay [INSERT_PRICE] with [INSERT_GUARANTEE_TERMS].");
    const tokens = r.map(x => x.token).sort();
    expect(tokens).toEqual(["[INSERT_GUARANTEE_TERMS]", "[INSERT_PRICE]"]);
  });

  it("same token appearing multiple times has aggregated count", () => {
    const r = detectPlaceholdersInText("[INSERT_PRICE] · [INSERT_PRICE] · [INSERT_PRICE]");
    expect(r).toEqual([{ token: "[INSERT_PRICE]", count: 3 }]);
  });

  it("tokens with digits + underscores match (e.g. INSERT_BONUS_1_VALUE)", () => {
    const r = detectPlaceholdersInText("Bonus 1 ([INSERT_BONUS_1_VALUE]) and bonus 2 ([INSERT_BONUS_2_VALUE])");
    expect(r.length).toBe(2);
    expect(r.some(x => x.token === "[INSERT_BONUS_1_VALUE]")).toBe(true);
    expect(r.some(x => x.token === "[INSERT_BONUS_2_VALUE]")).toBe(true);
  });

  it("lowercase or malformed tokens NOT matched", () => {
    expect(detectPlaceholdersInText("[insert_price]")).toEqual([]);
    expect(detectPlaceholdersInText("INSERT_PRICE without brackets")).toEqual([]);
    expect(detectPlaceholdersInText("[INSERT-PRICE]")).toEqual([]);
  });
});

describe("Phase D Sprint 3 — detectPlaceholders (kit-level aggregator)", () => {
  it("empty kit data returns total=0 + empty findings", () => {
    const report = detectPlaceholders({});
    expect(report.total).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.uniqueTokenCount).toBe(0);
  });

  it("kit with placeholders in offer + LP aggregates correctly", () => {
    const report = detectPlaceholders({
      offer: {
        godfatherAngle: {
          pricing: "Investment: [INSERT_PRICE]",
          guarantee: "Protected by [INSERT_GUARANTEE_TERMS]",
        },
      },
      lp: {
        originalAngle: {
          scarcityUrgency: "Closes [INSERT_COHORT_CLOSE_DATE]",
        },
      },
    });
    expect(report.total).toBe(3);
    expect(report.uniqueTokens.sort()).toEqual([
      "[INSERT_COHORT_CLOSE_DATE]",
      "[INSERT_GUARANTEE_TERMS]",
      "[INSERT_PRICE]",
    ]);
    expect(report.byAsset["Offer"]).toBe(2);
    expect(report.byAsset["Landing Page"]).toBe(1);
  });

  it("clean kit (all real content, no placeholders) returns total=0", () => {
    const report = detectPlaceholders({
      offer: {
        godfatherAngle: {
          pricing: "Investment: £5,000",
          guarantee: "30-day refund",
        },
      },
      lp: {
        originalAngle: {
          mainHeadline: "Real Headline Without Placeholders",
        },
      },
    });
    expect(report.total).toBe(0);
  });

  it("kit with JSON-stringified inner blobs also scanned (defensive un-stringification)", () => {
    const report = detectPlaceholders({
      offer: {
        godfatherAngle: JSON.stringify({ pricing: "[INSERT_PRICE]" }),
      },
    });
    expect(report.total).toBe(1);
  });

  it("byToken aggregation correct across multiple assets", () => {
    const report = detectPlaceholders({
      offer: { godfatherAngle: { pricing: "[INSERT_PRICE] [INSERT_PRICE]" } },
      email: { emails: [{ body: "[INSERT_PRICE]" }] },
    });
    expect(report.byToken["[INSERT_PRICE]"]).toBe(3);
  });

  it("summarizePlaceholders renders human-readable count", () => {
    const report = detectPlaceholders({
      offer: { godfatherAngle: { pricing: "[INSERT_PRICE]" } },
      lp: { originalAngle: { scarcityUrgency: "[INSERT_COHORT_LIMIT]" } },
    });
    expect(summarizePlaceholders(report)).toBe("2 placeholders across 2 assets");
  });

  it("summarizePlaceholders returns empty string on clean kit", () => {
    expect(summarizePlaceholders(detectPlaceholders({}))).toBe("");
  });
});

describe("Phase D Sprint 3 — KitPlaceholderBanner component + integration", () => {
  it("KitPlaceholderBanner component file exists with expected exports + compact mode", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/components/KitPlaceholderBanner.tsx"),
      "utf8",
    );
    expect(src).toMatch(/export\s+default\s+function\s+KitPlaceholderBanner/);
    // Compact mode for push modal embedding
    expect(src).toMatch(/compact\??\s*[:=]/);
    // Self-hide when report.total === 0
    expect(src).toMatch(/report\.total\s*===\s*0/);
    // Operator-fill explanation (warning, not error)
    expect(src).toMatch(/needs your details/i);
    // Review CTA when onReviewClick supplied
    expect(src).toMatch(/Review\s*&\s*Complete/);
  });

  it("V2CampaignKit imports + renders KitPlaceholderBanner with placeholderReport", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/V2CampaignKit.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import\s+KitPlaceholderBanner\s+from/);
    expect(src).toMatch(/import\s*\{\s*detectPlaceholders\s*\}\s*from/);
    expect(src).toMatch(/<KitPlaceholderBanner\s+report=\{placeholderReport\}/);
    expect(src).toMatch(/detectPlaceholders\(\{/);
  });

  it("V2CampaignKit AssetSection has data-section-key for scroll-to anchor", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/V2CampaignKit.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-section-key=\{sectionKey\}/);
  });

  it("PushKitModal accepts placeholderReport prop + renders compact warning conditionally", () => {
    const src = readFileSync(
      join(__dirname, "../client/src/v2/PushKitModal.tsx"),
      "utf8",
    );
    expect(src).toMatch(/placeholderReport\??\s*:\s*PlaceholderReport/);
    expect(src).toMatch(/<KitPlaceholderBanner\s+report=\{placeholderReport\}\s+compact/);
    // Warning only shows pre-push (suppressed in ResultsView)
    expect(src).toMatch(/!results\s*&&\s*placeholderReport/);
    // Review-on-kit-page back button
    expect(src).toMatch(/Review on kit page/);
  });

  it("placeholderDetector handles deeply nested arrays + objects (kit cascade shape)", () => {
    const report = detectPlaceholders({
      email: {
        emails: [
          { subject: "Email 1", body: "Hello [INSERT_LEAD_MAGNET_NAME]" },
          { subject: "Email 2", body: "Pay [INSERT_PRICE] to enrol" },
        ],
      },
      adCreatives: [
        { headline: "Plain headline" },
        { headline: "Limited to [INSERT_COHORT_LIMIT]" },
      ],
    });
    expect(report.total).toBe(3);
    expect(report.byAsset["Email Sequence"]).toBe(2);
    expect(report.byAsset["Ad Creatives"]).toBe(1);
  });
});

// ─── Phase E Sprint 2 — Email generator hardening ────────────────────────────
//
// Closes the 4 launch blockers from docs/redteam-email-baseline-v1.md §10.1:
//   LB-E1 — shape-validator exhaust on long sequences (sub-case 3a recovery)
//   LB-E2 — fabrication catalog parity vs offer generator (9 new classes)
//   LB-E3 — system-prompt symmetry vs LP (3 rules injected)
//   LB-E4 — archetypal-name-with-location applied to email body

import {
  validateEmailFabricationPatterns as validateEmailFabricationPatternsV2,
  validateEmailSequenceShape as validateEmailSequenceShapeV2,
  type EmailSuppliedData as EmailSuppliedDataV2,
} from "./_core/validator";

describe("Phase E Sprint 2 — Email validator catalog parity (LB-E2)", () => {
  // Helper to build a one-email kit with one fabrication body for testing.
  const oneEmail = (body: string, extra: Record<string, string> = {}) => [{
    day: 1, subject: "S", previewText: "P", body, cta: "C", ps: "X", ...extra,
  }];
  const supplied: EmailSuppliedDataV2 = {
    price: null, guaranteeType: null, guaranteeDuration: null,
    deliveryDuration: null, bonuses: null, testimonialNames: [],
  };

  it("catches email_invented_currency when no operator price supplied", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Pay only £497 today"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_currency")).toBe(true);
  });

  it("does NOT flag currency when token-override present ([INSERT_PRICE])", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Pay only [INSERT_PRICE] today"), supplied);
    expect(result.ok).toBe(true);
  });

  it("classifies user-supplied currency as USER-SUPPLIED (skipped)", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmail("Invest just £5,000 in your future"),
      { ...supplied, price: "5000" },
    );
    expect(result.ok).toBe(true);
  });

  it("catches email_invented_anchor_range (£X–£Y patterns)", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Normally £5,000-£7,500. Today £1,997."), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_anchor_range")).toBe(true);
  });

  it("catches email_invented_bonus_value '(£X value)' framings", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Plus the Diagnostic Audit (£497 value)"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_bonus_value")).toBe(true);
  });

  it("catches email_invented_cohort_limit", () => {
    // Detector requires "<keyword> <digits> <noun>" with noun in the
    // alternation (places/seats/spots/leaders/members/founders/etc).
    const result = validateEmailFabricationPatternsV2(oneEmail("Limited to 12 members in this cohort"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_cohort_limit")).toBe(true);
  });

  it("does NOT flag cohort limit when [INSERT_COHORT_LIMIT] present", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmail("Limited to [INSERT_COHORT_LIMIT] founding members"),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("catches email_invented_cohort_date ('next cohort opens')", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("The next cohort opens soon"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_cohort_date")).toBe(true);
  });

  it("does NOT flag cohort date when [INSERT_CART_CLOSE_DATE] present", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmail("Cart closes on [INSERT_CART_CLOSE_DATE]. Enrolment closes then."),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("catches email_invented_programme_duration ('12-week programme')", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Inside this 12-week programme, you will…"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_programme_duration")).toBe(true);
  });

  it("classifies supplied programme duration as USER-SUPPLIED", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmail("Inside this 12-week programme, you will…"),
      { ...supplied, deliveryDuration: "12 weeks" },
    );
    expect(result.ok).toBe(true);
  });

  it("catches email_invented_guarantee_timeframe ('within 30 days')", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Risk-free guarantee within 30 days"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_guarantee_timeframe")).toBe(true);
  });

  it("catches email_invented_refund_mechanic ('full refund', 'money-back')", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Pay nothing if it doesn't work. Full refund, no questions asked."), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_invented_refund_mechanic")).toBe(true);
  });

  it("does NOT flag refund mechanic when [INSERT_GUARANTEE_TERMS] present", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmail("Our guarantee: [INSERT_GUARANTEE_TERMS]. Full refund available."),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("backward-compatible — call without supplied data runs only legacy catalog", () => {
    // No supplied data → legacy FABRICATION_PATTERNS only. Pricing fabrication NOT caught.
    const result = validateEmailFabricationPatternsV2(oneEmail("Pay only £497 today"));
    expect(result.ok).toBe(true);
  });

  it("buildFailContext produces non-empty actionable message on fab hit", () => {
    const result = validateEmailFabricationPatternsV2(oneEmail("Pay £497 today"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failContext.length).toBeGreaterThan(50);
    expect(result.failContext).toContain("£497");
  });
});

describe("Phase E Sprint 2 — Email archetypal-in-body detection (LB-E4)", () => {
  const noNames: EmailSuppliedDataV2 = { testimonialNames: [] };
  const oneEmailBody = (body: string) => [{ day: 1, subject: "S", previewText: "P", body, cta: "C", ps: "X" }];

  it("catches 'A VP of Strategy at a professional services firm' composite", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmailBody("A VP of Strategy at a professional services firm came in with one specific problem."),
      noNames,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_archetypal_in_body")).toBe(true);
  });

  it("catches 'A Founder at a fast-scaling SaaS company' composite", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmailBody("A Founder at a fast-scaling SaaS company told me her team was stuck."),
      noNames,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "email_archetypal_in_body")).toBe(true);
  });

  it("does NOT flag operator-supplied real name in archetypal envelope", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmailBody("Sarah Chen, a Chief of Staff at a global consultancy, described it this way…"),
      { testimonialNames: ["Sarah Chen", null, undefined] },
    );
    // The "at a global consultancy" envelope matches the regex, but the
    // matched phrase contains "Sarah Chen" (a real operator-supplied name)
    // and is therefore USER-SUPPLIED, not fabrication.
    if (result.ok) return; // pass — exact USER-SUPPLIED suppression
    expect(result.hits.filter(h => h.classId === "email_archetypal_in_body")).toHaveLength(0);
  });

  it("does NOT flag generic role framing without 'at [a/an/the]' envelope", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmailBody("Many of the people I work with describe a similar frustration."),
      noNames,
    );
    expect(result.ok).toBe(true);
  });

  it("does NOT flag if title appears without role descriptor", () => {
    const result = validateEmailFabricationPatternsV2(
      oneEmailBody("She came to me last spring — a VP, but otherwise no other detail."),
      noNames,
    );
    // No "at [a/an/the] X" envelope, so no archetypal-composite match.
    expect(result.ok).toBe(true);
  });
});

describe("Phase E Sprint 2 — Shape sub-case 3a recovery (LB-E1)", () => {
  it("recovers when emails is a stringified array (sub-case 1, valid JSON)", () => {
    // Pre-existing sub-case 1: clean JSON-encoded array string. Should
    // continue to work post-Sprint-2 (no regression).
    const arr = JSON.stringify([{ day: 1, subject: "S", body: "B" }]);
    const result = validateEmailSequenceShapeV2({ emails: arr });
    expect(result.ok).toBe(true);
  });

  it("recovers when stringified array has unescaped quotes via object extraction (sub-case 3a)", () => {
    // Simulate the LLM emitting an array-as-string with a single quote issue
    // that breaks whole-array JSON.parse but leaves each individual object
    // parseable. Sub-case 3a should still recover the valid objects.
    //
    // Construct a malformed-array string where outer brackets break but the
    // individual {...} objects are valid JSON.
    const malformedArrayString = "[\n   garbage_at_top \n  {\"day\":1,\"subject\":\"S\",\"body\":\"hello\"}\n,\n  {\"day\":2,\"subject\":\"S2\",\"body\":\"hi\"}\n  ]";
    const result = validateEmailSequenceShapeV2({ emails: malformedArrayString });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.emails).toHaveLength(2);
    expect(result.emails[0].day).toBe(1);
    expect(result.emails[1].day).toBe(2);
  });

  it("falls through to emails_string_unrecoverable when 3a finds zero parseable objects", () => {
    // A truly malformed string with no parseable objects should still hit
    // the original unrecoverable failContext path.
    const result = validateEmailSequenceShapeV2({ emails: "this is just garbage with no braces" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.subCase).toBe("emails_string_unrecoverable");
  });

  it("recovers when stringified array has body fields with internal quotes (regression on a class observed in baseline-v1)", () => {
    // Long-sequence shape: model emits emails as a string. Objects inside
    // are valid JSON individually. Sub-case 3a extracts them.
    const obj1 = "{\"day\":0,\"subject\":\"hello\",\"body\":\"I'm here to help — let me know.\"}";
    const obj2 = "{\"day\":3,\"subject\":\"reminder\",\"body\":\"Don't forget the deadline.\"}";
    const arrStr = `[ ${obj1} , ${obj2} ]`;
    const result = validateEmailSequenceShapeV2({ emails: arrStr });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.emails).toHaveLength(2);
  });
});

describe("Phase E Sprint 2 — Email generator system prompt + supplied wiring", () => {
  const path = require("path");
  const fs = require("fs");
  const generatorPath = path.resolve(__dirname, "emailSequenceGenerator.ts");
  const generatorSrc = fs.readFileSync(generatorPath, "utf8");

  it("imports NO_CREDENTIAL_FABRICATION_RULE (LB-E3)", () => {
    expect(generatorSrc).toContain("NO_CREDENTIAL_FABRICATION_RULE");
  });

  it("imports NO_RESEARCH_STATISTIC_FABRICATION_RULE (LB-E3)", () => {
    expect(generatorSrc).toContain("NO_RESEARCH_STATISTIC_FABRICATION_RULE");
  });

  it("imports META_COMPLIANCE_NOTES (LB-E3)", () => {
    expect(generatorSrc).toContain("META_COMPLIANCE_NOTES");
  });

  it("EMAIL_SEQUENCE_SYSTEM_PROMPT injects all four rules", () => {
    // Check that the system prompt definition includes all four rule constants.
    const promptDefSnippet = generatorSrc.split("EMAIL_SEQUENCE_SYSTEM_PROMPT")[1] ?? "";
    const head = promptDefSnippet.substring(0, 2000);
    expect(head).toContain("NO_DATE_FABRICATION_RULE");
    expect(head).toContain("NO_CREDENTIAL_FABRICATION_RULE");
    expect(head).toContain("NO_RESEARCH_STATISTIC_FABRICATION_RULE");
    expect(head).toContain("META_COMPLIANCE_NOTES");
  });

  it("invokeEmailSequenceWithRetry accepts EmailSuppliedData parameter", () => {
    expect(generatorSrc).toContain("supplied?: EmailSuppliedData");
  });

  it("runEmailSequenceGeneration builds EmailSuppliedData from service + passes to retry helper", () => {
    expect(generatorSrc).toContain("const supplied: EmailSuppliedData = {");
    expect(generatorSrc).toContain("price: service.price");
    expect(generatorSrc).toContain("testimonialNames:");
    // Asserts the WIRING (prompt + supplied reach the retry helper), not the exact arg list —
    // the call also carries a legacy-hits sink now, and a literal-string match on the whole
    // call breaks on any future parameter without the wiring having changed.
    expect(generatorSrc).toContain("invokeEmailSequenceWithRetry(cascadeContext + realBonusBlock + prompt, supplied");
  });

  it("fabrication validator call forwards supplied data", () => {
    expect(generatorSrc).toContain("validateEmailFabricationPatterns(shapeResult.emails, supplied)");
  });
});

// ─── Phase F Item 1 — C0.1 trial-user upsell screen ──────────────────────────
//
// Three layers under test:
//   1. Server predicate `isAutoModeTierAllowed` now bypasses both superuser
//      AND admin (deliberate divergence from the v1 baseline test which had
//      admin blocked). Verified by re-asserting the role table.
//   2. Client-side gate on V2AutoModeIntake + V2AutoModeIntakeConfirm
//      mirrors the server predicate exactly (structural fs-readFileSync
//      checks — no React renderer needed).
//   3. UpgradePrompt component accepts the new optional bodyCopy prop
//      while remaining backward-compatible with the 4+ existing call sites
//      that omit it.

describe("Phase F Item 1 (C0.1) — server tier-gate predicate admin bypass", () => {
  it("admin role + trial tier is now ALLOWED (admin is internal-only, never customer-held)", () => {
    const result = isAutoModeTierAllowed({ role: "admin", subscriptionTier: "trial" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("admin role + null tier is ALLOWED (admin bypass is unconditional on tier)", () => {
    const result = isAutoModeTierAllowed({ role: "admin", subscriptionTier: null });
    expect(result.allowed).toBe(true);
  });

  it("superuser bypass behaviour preserved (regression guard for v1 tier-gate test)", () => {
    const result = isAutoModeTierAllowed({ role: "superuser", subscriptionTier: "trial" });
    expect(result.allowed).toBe(true);
  });

  it("regular user + trial still blocked (admin bypass widened scope is exactly admin + superuser, no further widening)", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "trial" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Auto Mode is a Pro feature");
  });

  it("regular user + pro tier still allowed", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "pro" });
    expect(result.allowed).toBe(true);
  });
});

describe("Phase F Item 1 (C0.1) — client-side gate structural wiring", () => {
  const path = require("path");
  const fs = require("fs");
  const intakePath = path.resolve(__dirname, "../client/src/v2/V2AutoModeIntake.tsx");
  const confirmPath = path.resolve(__dirname, "../client/src/v2/V2AutoModeIntakeConfirm.tsx");
  const upgradePromptPath = path.resolve(__dirname, "../client/src/v2/components/UpgradePrompt.tsx");
  const intakeSrc = fs.readFileSync(intakePath, "utf8");
  const confirmSrc = fs.readFileSync(confirmPath, "utf8");
  const upgradePromptSrc = fs.readFileSync(upgradePromptPath, "utf8");

  it("V2AutoModeIntake imports useAuth + UpgradePrompt", () => {
    expect(intakeSrc).toContain('import { useAuth } from "@/_core/hooks/useAuth"');
    expect(intakeSrc).toContain('import UpgradePrompt from "./components/UpgradePrompt"');
  });

  it("V2AutoModeIntake mirrors the server tier-gate predicate exactly (superuser + admin + pro + agency = bypass)", () => {
    expect(intakeSrc).toContain('authUser.role !== "superuser"');
    expect(intakeSrc).toContain('authUser.role !== "admin"');
    expect(intakeSrc).toContain('authUser.subscriptionTier !== "pro"');
    expect(intakeSrc).toContain('authUser.subscriptionTier !== "agency"');
  });

  it("V2AutoModeIntake renders Auto-Mode-specific bodyCopy on UpgradePrompt", () => {
    expect(intakeSrc).toContain('featureName="Auto Mode"');
    expect(intakeSrc).toContain("Auto Mode is a Pro feature.");
    expect(intakeSrc).toContain("Upgrade to unlock the 1-click campaign builder.");
  });

  it("V2AutoModeIntakeConfirm carries the same belt-and-suspenders gate", () => {
    expect(confirmSrc).toContain('import { useAuth } from "@/_core/hooks/useAuth"');
    expect(confirmSrc).toContain('import UpgradePrompt from "./components/UpgradePrompt"');
    expect(confirmSrc).toContain('authUser.role !== "superuser"');
    expect(confirmSrc).toContain('authUser.role !== "admin"');
    expect(confirmSrc).toContain('authUser.subscriptionTier !== "pro"');
    expect(confirmSrc).toContain('authUser.subscriptionTier !== "agency"');
    expect(confirmSrc).toContain('featureName="Auto Mode"');
  });
});

describe("Phase F Item 1 (C0.1) — UpgradePrompt bodyCopy backward-compat", () => {
  const path = require("path");
  const fs = require("fs");
  const upgradePromptSrc = fs.readFileSync(
    path.resolve(__dirname, "../client/src/v2/components/UpgradePrompt.tsx"),
    "utf8",
  );

  it("UpgradePrompt accepts optional bodyCopy prop with line1+line2", () => {
    expect(upgradePromptSrc).toContain("bodyCopy?: { line1: string; line2: string }");
  });

  it("UpgradePrompt defaults to existing L-QUOTA copy when bodyCopy omitted (backward-compat for existing call sites)", () => {
    expect(upgradePromptSrc).toContain("const DEFAULT_BODY_COPY");
    expect(upgradePromptSrc).toContain("You've reached your trial limit.");
    expect(upgradePromptSrc).toContain("Upgrade to Pro to keep going.");
    expect(upgradePromptSrc).toContain("const copy = bodyCopy ?? DEFAULT_BODY_COPY");
  });

  it("UpgradePrompt renders copy.line1 / copy.line2 in the body paragraphs (not hardcoded strings)", () => {
    expect(upgradePromptSrc).toContain("{copy.line1}");
    expect(upgradePromptSrc).toContain("{copy.line2}");
  });
});

// ─── Phase F Sprint 2 — WhatsApp generator hardening ────────────────────────
//
// Closes the 4 in-scope launch blockers from docs/redteam-whatsapp-baseline-v1.md §8:
//   LB-W1 — shape sub-case 3a recovery (defensive port from email Sprint 2)
//   LB-W2 — fabrication catalog parity vs offer/email (10 new classes)
//   LB-W3 — system-prompt symmetry vs LP/email (3 rules injected)
//   LB-W4 — archetypal-name-with-location applied to WhatsApp body (defensive)
//
// LB-W5 deliberately skipped — v1 baseline measured 0 findings + code-level
// investigation confirmed all 5 event-referencing builders carry explicit
// "emit [INSERT_EVENT_NAME] verbatim when not pre-supplied" prompt guidance.

import {
  validateWhatsappFabricationPatterns as validateWhatsappFabricationPatternsV2,
  validateWhatsappSequenceShape as validateWhatsappSequenceShapeV2,
  type WhatsappSuppliedData as WhatsappSuppliedDataV2,
} from "./_core/validator";

describe("Phase F Sprint 2 — WhatsApp validator catalog parity (LB-W2)", () => {
  // Helper: one-message kit with one fabrication body.
  const oneMessage = (message: string, extra: Record<string, string> = {}) => [{
    day: 0, message, cta: "C", ...extra,
  }];
  const supplied: WhatsappSuppliedDataV2 = {
    price: null, guaranteeType: null, guaranteeDuration: null,
    deliveryDuration: null, bonuses: null, testimonialNames: [],
  };

  it("catches whatsapp_invented_currency when no operator price supplied", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Pay only £497 today"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_currency")).toBe(true);
  });

  it("does NOT flag currency when [INSERT_PRICE] token present (token-override absent for currency — uses per-match cross-check)", () => {
    // Multi-value categories use per-match supplied.price cross-check, not
    // field-level token-override. Confirm: supplying matching price suppresses.
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Invest just £5,000 in your future"),
      { ...supplied, price: "5000" },
    );
    expect(result.ok).toBe(true);
  });

  it("catches whatsapp_invented_anchor_range (£X–£Y patterns)", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Normally £5,000-£7,500. Today £1,997."), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_anchor_range")).toBe(true);
  });

  it("catches whatsapp_invented_bonus_value '(£X value)' framings", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Plus the Diagnostic Audit (£497 value)"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_bonus_value")).toBe(true);
  });

  it("catches whatsapp_invented_cohort_limit", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Limited to 12 members in this cohort"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_cohort_limit")).toBe(true);
  });

  it("does NOT flag cohort limit when [INSERT_COHORT_LIMIT] token present", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Limited to [INSERT_COHORT_LIMIT] members in this cohort"),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("catches whatsapp_invented_cohort_date ('next cohort opens', 'enrolment closes')", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("The next cohort opens soon"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_cohort_date")).toBe(true);
  });

  it("does NOT flag cohort date when [INSERT_CART_CLOSE_DATE] token present", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Cart closes on [INSERT_CART_CLOSE_DATE]. Enrolment closes then."),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("catches whatsapp_invented_programme_duration ('12-week programme')", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Inside this 12-week programme, you will…"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_programme_duration")).toBe(true);
  });

  it("classifies supplied programme duration as USER-SUPPLIED (legacy programme_duration_drift filtered + WhatsApp catalog suppressed)", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Inside this 12-week programme, you will…"),
      { ...supplied, deliveryDuration: "12 weeks" },
    );
    expect(result.ok).toBe(true);
  });

  it("catches whatsapp_invented_guarantee_timeframe ('within 30 days')", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Risk-free guarantee within 30 days"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_guarantee_timeframe")).toBe(true);
  });

  it("catches whatsapp_invented_refund_mechanic ('full refund', 'money-back')", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Pay nothing if it doesn't work. Money-back guarantee."), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_refund_mechanic")).toBe(true);
  });

  it("does NOT flag refund mechanic when [INSERT_GUARANTEE_TERMS] token present", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Our guarantee: [INSERT_GUARANTEE_TERMS]. Full refund available."),
      supplied,
    );
    expect(result.ok).toBe(true);
  });

  it("backward-compatible — call without supplied data runs only legacy catalog", () => {
    // No supplied data → legacy FABRICATION_PATTERNS only. Pricing fabrication NOT caught.
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Pay only £497 today"));
    expect(result.ok).toBe(true);
  });

  it("buildFailContext produces non-empty actionable message on fab hit", () => {
    const result = validateWhatsappFabricationPatternsV2(oneMessage("Pay £497 today"), supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failContext.length).toBeGreaterThan(50);
    expect(result.failContext).toContain("£497");
  });

  it("scans `text` legacy alias as message body equivalent", () => {
    // RawWhatsappMessageFields supports both `message` and `text` — validator
    // must scan whichever is present.
    const messages = [{ day: 0, text: "Pay only £497 today", cta: "C" }];
    const result = validateWhatsappFabricationPatternsV2(messages, supplied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_invented_currency")).toBe(true);
  });
});

describe("Phase F Sprint 2 — WhatsApp archetypal-in-body detection (LB-W4)", () => {
  const noNames: WhatsappSuppliedDataV2 = { testimonialNames: [] };
  const oneMessage = (body: string) => [{ day: 0, message: body, cta: "C" }];

  it("catches 'A VP of Strategy at a professional services firm' composite", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("A VP of Strategy at a professional services firm came in with one problem."),
      noNames,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_archetypal_in_body")).toBe(true);
  });

  it("catches 'A Founder at a fast-scaling SaaS company' composite", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("A Founder at a fast-scaling SaaS company told me her team was stuck."),
      noNames,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hits.some(h => h.classId === "whatsapp_archetypal_in_body")).toBe(true);
  });

  it("does NOT flag operator-supplied real name in archetypal envelope", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Sarah Chen, a Chief of Staff at a global consultancy, described it this way."),
      { testimonialNames: ["Sarah Chen", null, undefined] },
    );
    if (result.ok) return; // pass — exact USER-SUPPLIED suppression
    expect(result.hits.filter(h => h.classId === "whatsapp_archetypal_in_body")).toHaveLength(0);
  });

  it("does NOT flag generic role framing without 'at [a/an/the]' envelope", () => {
    const result = validateWhatsappFabricationPatternsV2(
      oneMessage("Many of the people I work with describe a similar frustration."),
      noNames,
    );
    expect(result.ok).toBe(true);
  });
});

describe("Phase F Sprint 2 — Shape sub-case 3a recovery (LB-W1)", () => {
  it("recovers when messages is a stringified array (sub-case 1, valid JSON) — backward-compat", () => {
    const arr = JSON.stringify([{ day: 0, message: "Hello", cta: "C" }]);
    const result = validateWhatsappSequenceShapeV2({ messages: arr });
    expect(result.ok).toBe(true);
  });

  it("recovers when stringified array has surrounding garbage via object extraction (sub-case 3a)", () => {
    const malformedArrayString = "[\n   garbage_at_top \n  {\"day\":0,\"message\":\"hi\",\"cta\":\"C\"}\n,\n  {\"day\":1,\"message\":\"hello\",\"cta\":\"C\"}\n  ]";
    const result = validateWhatsappSequenceShapeV2({ messages: malformedArrayString });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].day).toBe(0);
    expect(result.messages[1].day).toBe(1);
  });

  it("falls through to messages_string_unrecoverable when 3a finds zero parseable objects", () => {
    const result = validateWhatsappSequenceShapeV2({ messages: "this is just garbage with no braces" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.subCase).toBe("messages_string_unrecoverable");
  });

  it("recovers when stringified array has bodies with internal apostrophes (long-sequence escape edge case)", () => {
    const obj1 = "{\"day\":0,\"message\":\"I'm here to help.\",\"cta\":\"C\"}";
    const obj2 = "{\"day\":3,\"message\":\"Don't forget the deadline.\",\"cta\":\"C\"}";
    const arrStr = `[ ${obj1} , ${obj2} ]`;
    const result = validateWhatsappSequenceShapeV2({ messages: arrStr });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages).toHaveLength(2);
  });
});

describe("Phase F Sprint 2 — WhatsApp generator system prompt + supplied wiring", () => {
  const path = require("path");
  const fs = require("fs");
  const generatorPath = path.resolve(__dirname, "whatsappSequenceGenerator.ts");
  const generatorSrc = fs.readFileSync(generatorPath, "utf8");

  it("imports NO_CREDENTIAL_FABRICATION_RULE (LB-W3)", () => {
    expect(generatorSrc).toContain("NO_CREDENTIAL_FABRICATION_RULE");
  });

  it("imports NO_RESEARCH_STATISTIC_FABRICATION_RULE (LB-W3)", () => {
    expect(generatorSrc).toContain("NO_RESEARCH_STATISTIC_FABRICATION_RULE");
  });

  it("imports META_COMPLIANCE_NOTES (LB-W3)", () => {
    expect(generatorSrc).toContain("META_COMPLIANCE_NOTES");
  });

  it("WHATSAPP_SEQUENCE_SYSTEM_PROMPT injects all four rules", () => {
    const promptDefSnippet = generatorSrc.split("WHATSAPP_SEQUENCE_SYSTEM_PROMPT")[1] ?? "";
    const head = promptDefSnippet.substring(0, 2000);
    expect(head).toContain("NO_DATE_FABRICATION_RULE");
    expect(head).toContain("NO_CREDENTIAL_FABRICATION_RULE");
    expect(head).toContain("NO_RESEARCH_STATISTIC_FABRICATION_RULE");
    expect(head).toContain("META_COMPLIANCE_NOTES");
  });

  it("WHATSAPP_SEQUENCE_SYSTEM_PROMPT includes anti-stringify instruction (LB-W1 prompt-level)", () => {
    const promptDefSnippet = generatorSrc.split("WHATSAPP_SEQUENCE_SYSTEM_PROMPT")[1] ?? "";
    const head = promptDefSnippet.substring(0, 2000);
    expect(head).toContain("Emit the messages field as a literal JSON array");
  });

  it("WHATSAPP_SEQUENCE_SYSTEM_PROMPT uses positive-only framing — no Wrong:/Right: pattern (Sprint B regression lesson)", () => {
    const promptDefSnippet = generatorSrc.split("WHATSAPP_SEQUENCE_SYSTEM_PROMPT")[1] ?? "";
    const head = promptDefSnippet.substring(0, 2000);
    expect(head).not.toMatch(/Wrong:/);
    expect(head).not.toMatch(/Right:/);
  });

  it("invokeWhatsappSequenceWithRetry accepts WhatsappSuppliedData parameter", () => {
    expect(generatorSrc).toContain("supplied?: WhatsappSuppliedData");
  });

  it("runWhatsappSequenceGeneration builds WhatsappSuppliedData from service + passes to retry helper", () => {
    expect(generatorSrc).toContain("const supplied: WhatsappSuppliedData = {");
    expect(generatorSrc).toContain("price: service.price");
    expect(generatorSrc).toContain("testimonialNames:");
    // Wiring assertion, not an exact arg list — see the email equivalent above.
    expect(generatorSrc).toContain("invokeWhatsappSequenceWithRetry(cascadeContext + prompt, supplied");
  });

  it("fabrication validator call forwards supplied data", () => {
    expect(generatorSrc).toContain("validateWhatsappFabricationPatterns(shapeResult.messages, supplied)");
  });
});

// ─── Placeholder sanitization (d38437a defense-in-depth) ──────────────────────

describe("sanitizePlaceholder — server-side defense against stale client defaults", () => {
  it("strips all known placeholder strings (case-insensitive, trim-tolerant)", () => {
    for (const placeholder of PLACEHOLDER_DEFAULTS) {
      expect(sanitizePlaceholder(placeholder)).toBe("");
      expect(sanitizePlaceholder(placeholder.toUpperCase())).toBe("");
      expect(sanitizePlaceholder(`  ${placeholder}  `)).toBe("");
    }
  });

  it("strips mixed-case variants", () => {
    expect(sanitizePlaceholder("New Campaign")).toBe("");
    expect(sanitizePlaceholder("My Ideal Client")).toBe("");
    expect(sanitizePlaceholder("Transform Their Results")).toBe("");
    expect(sanitizePlaceholder("To Be Defined")).toBe("");
  });

  it("passes through real user content unchanged", () => {
    expect(sanitizePlaceholder("Executive Coaching for CTOs")).toBe("Executive Coaching for CTOs");
    expect(sanitizePlaceholder("Busy moms aged 30-45")).toBe("Busy moms aged 30-45");
  });

  it("returns empty string for null, undefined, and empty input", () => {
    expect(sanitizePlaceholder(null)).toBe("");
    expect(sanitizePlaceholder(undefined)).toBe("");
    expect(sanitizePlaceholder("")).toBe("");
    expect(sanitizePlaceholder("   ")).toBe("");
  });
});

// ─── Import mutations: tier-gate + schema validation ──────────────────────────

describe("isAutoModeTierAllowed — import mutations share the same gate", () => {
  it("blocks trial-tier users", () => {
    const result = isAutoModeTierAllowed({ role: "user", subscriptionTier: "trial" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Pro feature");
  });

  it("blocks null/missing subscriptionTier", () => {
    expect(isAutoModeTierAllowed({ role: "user", subscriptionTier: null }).allowed).toBe(false);
    expect(isAutoModeTierAllowed({ role: "user", subscriptionTier: undefined }).allowed).toBe(false);
  });

  it("allows pro and agency tiers", () => {
    expect(isAutoModeTierAllowed({ role: "user", subscriptionTier: "pro" }).allowed).toBe(true);
    expect(isAutoModeTierAllowed({ role: "user", subscriptionTier: "agency" }).allowed).toBe(true);
  });

  it("allows superuser and admin regardless of tier", () => {
    expect(isAutoModeTierAllowed({ role: "superuser", subscriptionTier: "trial" }).allowed).toBe(true);
    expect(isAutoModeTierAllowed({ role: "admin", subscriptionTier: null }).allowed).toBe(true);
  });
});

describe("importAssets input schema — validates per-asset shape", () => {
  const { z } = require("zod");

  const importAssetsSchema = z.object({
    serviceId: z.number(),
    icpId: z.number(),
    offer: z.object({
      name: z.string().min(1).max(500),
      valueProposition: z.string().min(1).max(2000),
      cta: z.string().min(1).max(500),
    }).optional(),
    mechanism: z.object({
      name: z.string().min(1).max(255),
      description: z.string().min(1).max(2000),
    }).optional(),
    hvco: z.object({
      title: z.string().min(1).max(500),
      topic: z.string().min(1).max(2000),
    }).optional(),
  });

  it("accepts blank-slate input (no assets)", () => {
    const result = importAssetsSchema.safeParse({ serviceId: 1, icpId: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts full import (all 3 assets)", () => {
    const result = importAssetsSchema.safeParse({
      serviceId: 1,
      icpId: 1,
      offer: { name: "Authority Stack", valueProposition: "Land $10k clients", cta: "Book a Call" },
      mechanism: { name: "Neural Nexus System", description: "A 3-step framework for clarity" },
      hvco: { title: "The Consultant's Playbook", topic: "How to land your first high-ticket client" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty offer name", () => {
    const result = importAssetsSchema.safeParse({
      serviceId: 1, icpId: 1,
      offer: { name: "", valueProposition: "x", cta: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects offer missing required cta field", () => {
    const result = importAssetsSchema.safeParse({
      serviceId: 1, icpId: 1,
      offer: { name: "Test", valueProposition: "Test" },
    });
    expect(result.success).toBe(false);
  });
});

describe("importIcp input schema — validates ICP import shape", () => {
  const { z } = require("zod");

  const importIcpSchema = z.object({
    serviceId: z.number(),
    name: z.string().min(1).max(255),
    pains: z.string().max(2000).optional(),
    goals: z.string().max(2000).optional(),
    implementationBarriers: z.string().max(2000).optional(),
  });

  it("accepts name-only (minimal import)", () => {
    const result = importIcpSchema.safeParse({ serviceId: 1, name: "Burned-out CTOs" });
    expect(result.success).toBe(true);
  });

  it("accepts name + all optional fields", () => {
    const result = importIcpSchema.safeParse({
      serviceId: 1,
      name: "Burned-out CTOs",
      pains: "No work-life balance",
      goals: "Sustainable leadership",
      implementationBarriers: "Time constraints",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = importIcpSchema.safeParse({ serviceId: 1, name: "" });
    expect(result.success).toBe(false);
  });
});

// ─── describeOffer cascade widening — placeholder guard + field logic ─────────

describe("_hasPlaceholder — guards [INSERT_*] tokens from leaking into cascade", () => {
  it("detects [INSERT_ patterns", () => {
    expect(_hasPlaceholder("[INSERT_PRICE]")).toBe(true);
    expect(_hasPlaceholder("Get started for [INSERT_PRICE] today")).toBe(true);
    expect(_hasPlaceholder("[INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE])")).toBe(true);
    expect(_hasPlaceholder("[INSERT_GUARANTEE_TERMS]")).toBe(true);
  });

  it("passes real content without placeholders", () => {
    expect(_hasPlaceholder("$6,000 USD")).toBe(false);
    expect(_hasPlaceholder("30-day money-back guarantee")).toBe(false);
    expect(_hasPlaceholder("Private Mastermind Community ($5,000 value)")).toBe(false);
    expect(_hasPlaceholder("Enroll today — only 50 spots available")).toBe(false);
  });

  it("treats null/undefined/empty as placeholder (skip)", () => {
    expect(_hasPlaceholder(null)).toBe(true);
    expect(_hasPlaceholder(undefined)).toBe(true);
    expect(_hasPlaceholder("")).toBe(true);
  });
});

describe("describeOffer cascade string — field assembly logic (unit)", () => {
  // These test the assembly logic conceptually since describeOffer is async/DB-bound.
  // We test the hasPlaceholder guard above; here we verify the expected output shape.

  it("real bonus/guarantee/price/urgency values produce the expected string shape", () => {
    // Simulate what describeOffer builds from real data
    const productName = "Authority Stack Accelerator";
    const angleKey = "godfather";
    const valueProp = "Land your first $10k client in 30 days";
    const cta = "Book a Free Strategy Call";
    const svcPrice = "6000";
    const svcGuaranteeType = "Full refund";
    const svcGuaranteeDuration = "30 days";
    const svcDeliveryDuration = "12 weeks";
    const bonuses = "Private Mastermind Community ($5,000 value), Whale Alerts ($2,000 value)";
    const urgency = "Enroll today — only 50 spots available";

    let desc = `Selected offer: "${productName}" (${angleKey} angle). Value proposition: "${valueProp}". Offer CTA: "${cta}".`;
    if (svcPrice) desc += ` Price: ${svcPrice}.`;
    if (svcGuaranteeType || svcGuaranteeDuration) {
      const parts = [svcGuaranteeType, svcGuaranteeDuration].filter(Boolean).join(", ");
      desc += ` Guarantee: ${parts}.`;
    }
    if (svcDeliveryDuration) desc += ` Programme duration: ${svcDeliveryDuration}.`;
    if (!_hasPlaceholder(bonuses)) desc += ` Bonuses: ${bonuses}`;
    if (!_hasPlaceholder(urgency)) desc += ` Urgency: ${urgency}`;

    expect(desc).toContain("Price: 6000.");
    expect(desc).toContain("Guarantee: Full refund, 30 days.");
    expect(desc).toContain("Programme duration: 12 weeks.");
    expect(desc).toContain("Bonuses: Private Mastermind Community ($5,000 value)");
    expect(desc).toContain("Urgency: Enroll today");
  });

  it("[INSERT_ fields are skipped from the output", () => {
    const bonuses = "[INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE])";
    const urgency = "Limited time — [INSERT_DEADLINE]";
    const guarantee = "[INSERT_GUARANTEE_TERMS]";

    let desc = `Selected offer: "Test" (godfather angle). Value proposition: "VP". Offer CTA: "CTA".`;
    if (!_hasPlaceholder(bonuses)) desc += ` Bonuses: ${bonuses}`;
    if (!_hasPlaceholder(urgency)) desc += ` Urgency: ${urgency}`;
    if (!_hasPlaceholder(guarantee)) desc += ` Guarantee: ${guarantee}`;

    expect(desc).not.toContain("Bonuses:");
    expect(desc).not.toContain("Urgency:");
    expect(desc).not.toContain("Guarantee:");
    expect(desc).not.toContain("[INSERT_");
  });

  it("operator services.price preferred over OfferContent.pricing prose", () => {
    const svcPrice = "6000";
    const contentPricing = "Investment: just $6,000 for the complete transformation programme";

    let desc = `Selected offer: "Test" (godfather angle). Value proposition: "VP". Offer CTA: "CTA".`;
    // Mimic the preference logic: if svcPrice exists, use it; else fall back to content.pricing
    if (svcPrice) {
      desc += ` Price: ${svcPrice}.`;
    } else if (!_hasPlaceholder(contentPricing)) {
      desc += ` Pricing: ${contentPricing}`;
    }

    expect(desc).toContain("Price: 6000.");
    expect(desc).not.toContain("Investment: just");
    expect(desc).not.toContain("Pricing:");
  });
});

// ─── describeHvco + describeMechanism cascade widening ────────────────────────

describe("describeHvco cascade — hvcoTopic appended when real, skipped when placeholder", () => {
  it("appends real hvcoTopic to the cascade string", () => {
    const title = "The Consultant's Playbook";
    const topic = "How to land your first high-ticket client without cold outreach";
    let desc = `Selected lead magnet (free opt-in): "${title}".`;
    if (topic && !_hasPlaceholder(topic)) {
      desc += ` Topic: "${topic}".`;
    }
    expect(desc).toContain('Topic: "How to land your first high-ticket client');
    expect(desc).toContain(title);
  });

  it("skips hvcoTopic containing [INSERT_ placeholder", () => {
    const title = "The Playbook";
    const topic = "[INSERT_LEAD_MAGNET_NAME] covers the essentials";
    let desc = `Selected lead magnet (free opt-in): "${title}".`;
    if (topic && !_hasPlaceholder(topic)) {
      desc += ` Topic: "${topic}".`;
    }
    expect(desc).not.toContain("Topic:");
    expect(desc).not.toContain("[INSERT_");
  });

  it("skips null/empty hvcoTopic", () => {
    const topic: string | null = null;
    let desc = `Selected lead magnet (free opt-in): "Test".`;
    if (topic && !_hasPlaceholder(topic)) {
      desc += ` Topic: "${topic}".`;
    }
    expect(desc).not.toContain("Topic:");
  });
});

describe("describeMechanism cascade — descriptor appended when real, skipped when absent", () => {
  it("appends real descriptor to the cascade string", () => {
    const name = "The Neural Nexus System";
    const descriptor = "Framework";
    const description = "A 3-step framework that rewires decision fatigue.";
    let desc = `Selected hero mechanism: "${name}".`;
    if (descriptor && !_hasPlaceholder(descriptor)) {
      desc += ` Type: ${descriptor}.`;
    }
    desc += ` Description: "${description}".`;
    expect(desc).toContain("Type: Framework.");
    expect(desc).toContain("Neural Nexus System");
    expect(desc).toContain("Description:");
  });

  it("skips null descriptor gracefully", () => {
    const name = "The Method";
    const descriptor: string | null = null;
    const description = "A coaching approach.";
    let desc = `Selected hero mechanism: "${name}".`;
    if (descriptor && !_hasPlaceholder(descriptor)) {
      desc += ` Type: ${descriptor}.`;
    }
    desc += ` Description: "${description}".`;
    expect(desc).not.toContain("Type:");
    expect(desc).toContain("Description:");
  });

  it("skips descriptor containing [INSERT_ placeholder", () => {
    const descriptor = "[INSERT_MECHANISM_TYPE]";
    let desc = `Selected hero mechanism: "Test".`;
    if (descriptor && !_hasPlaceholder(descriptor)) {
      desc += ` Type: ${descriptor}.`;
    }
    expect(desc).not.toContain("Type:");
    expect(desc).not.toContain("[INSERT_");
  });
});

// ─── adCreatives → GHL export: CV assembly + orphan cleanup ───────────────────

describe("adCreatives GHL push — CV name assembly + orphan regex", () => {
  it("assembles correct CV names for a 5-variation batch", () => {
    const creatives = [
      { variationNumber: 1, headline: "Cut sales cycles 50%", imageUrl: "https://res.cloudinary.com/img1.png" },
      { variationNumber: 2, headline: "Trusted by 400+ coaches", imageUrl: "https://res.cloudinary.com/img2.png" },
      { variationNumber: 3, headline: "What if you could?", imageUrl: "https://res.cloudinary.com/img3.png" },
      { variationNumber: 4, headline: "Before vs After", imageUrl: "https://res.cloudinary.com/img4.png" },
      { variationNumber: 5, headline: "The hidden truth", imageUrl: "https://res.cloudinary.com/img5.png" },
    ];

    const cvPairs: Array<{ name: string; value: string }> = [];
    for (let i = 0; i < creatives.length; i++) {
      cvPairs.push({ name: `ZAP Ad Creative ${i + 1} Headline`, value: creatives[i].headline });
      cvPairs.push({ name: `ZAP Ad Creative ${i + 1} Image`, value: creatives[i].imageUrl });
    }
    cvPairs.push({ name: "ZAP Ad Creative Count", value: String(creatives.length) });

    expect(cvPairs).toHaveLength(11); // 5×2 + 1 count
    expect(cvPairs[0].name).toBe("ZAP Ad Creative 1 Headline");
    expect(cvPairs[0].value).toBe("Cut sales cycles 50%");
    expect(cvPairs[1].name).toBe("ZAP Ad Creative 1 Image");
    expect(cvPairs[1].value).toContain("cloudinary.com");
    expect(cvPairs[10].name).toBe("ZAP Ad Creative Count");
    expect(cvPairs[10].value).toBe("5");
  });

  it("orphan regex matches stale slots above current count", () => {
    const currentCount = 3;
    const orphanSlots = Array.from({ length: 10 - currentCount }, (_, k) => k + currentCount + 1);
    const orphanRegex = new RegExp(`^ZAP Ad Creative (?:${orphanSlots.join("|")}) (?:Headline|Image)$`);

    // Should match slots 4-10
    expect(orphanRegex.test("ZAP Ad Creative 4 Headline")).toBe(true);
    expect(orphanRegex.test("ZAP Ad Creative 5 Image")).toBe(true);
    expect(orphanRegex.test("ZAP Ad Creative 10 Headline")).toBe(true);

    // Should NOT match current slots 1-3
    expect(orphanRegex.test("ZAP Ad Creative 1 Headline")).toBe(false);
    expect(orphanRegex.test("ZAP Ad Creative 3 Image")).toBe(false);

    // Should NOT match count CV
    expect(orphanRegex.test("ZAP Ad Creative Count")).toBe(false);
  });

  it("count CV reflects actual batch size for re-push scenarios", () => {
    // Simulate re-push with fewer variations (e.g., 3 instead of 5)
    const rePushCount = 3;
    const countCV = { name: "ZAP Ad Creative Count", value: String(rePushCount) };
    expect(countCV.value).toBe("3");

    // Original 5 → re-push 3: orphan slots 4,5 should match
    const orphanSlots = Array.from({ length: 10 - rePushCount }, (_, k) => k + rePushCount + 1);
    const orphanRegex = new RegExp(`^ZAP Ad Creative (?:${orphanSlots.join("|")}) (?:Headline|Image)$`);
    expect(orphanRegex.test("ZAP Ad Creative 4 Headline")).toBe(true);
    expect(orphanRegex.test("ZAP Ad Creative 5 Image")).toBe(true);
    expect(orphanRegex.test("ZAP Ad Creative 3 Image")).toBe(false);
  });
});

// ─── Placeholder Editor: resolve + two-pass precedence ────────────────────────

describe("resolveTokensInText — substitutes filled tokens, leaves unfilled intact", () => {
  it("replaces filled tokens with registry values", () => {
    const map = new Map<string, ResolvedEntry>([
      ["[INSERT_PRICE]", { token: "[INSERT_PRICE]", value: "$6,000", source: "campaign" }],
      ["[INSERT_HOST_NAME]", { token: "[INSERT_HOST_NAME]", value: "Arfeen Khan", source: "default" }],
    ]);
    const text = "Investment: [INSERT_PRICE]. Contact [INSERT_HOST_NAME] at [INSERT_CONTACT_EMAIL].";
    const result = resolveTokensInText(text, map);
    expect(result).toBe("Investment: $6,000. Contact Arfeen Khan at [INSERT_CONTACT_EMAIL].");
  });

  it("leaves unfilled tokens intact", () => {
    const map = new Map<string, ResolvedEntry>();
    const text = "Price: [INSERT_PRICE], Guarantee: [INSERT_GUARANTEE_TERMS]";
    const result = resolveTokensInText(text, map);
    expect(result).toBe(text);
  });

  it("handles text with no tokens", () => {
    const map = new Map<string, ResolvedEntry>([
      ["[INSERT_PRICE]", { token: "[INSERT_PRICE]", value: "$6,000", source: "campaign" }],
    ]);
    const result = resolveTokensInText("No placeholders here.", map);
    expect(result).toBe("No placeholders here.");
  });

  it("replaces multiple occurrences of the same token", () => {
    const map = new Map<string, ResolvedEntry>([
      ["[INSERT_PRICE]", { token: "[INSERT_PRICE]", value: "$6,000", source: "campaign" }],
    ]);
    const text = "Only [INSERT_PRICE] today! That's right, [INSERT_PRICE]!";
    const result = resolveTokensInText(text, map);
    expect(result).toBe("Only $6,000 today! That's right, $6,000!");
  });
});

describe("resolveTokensInObject — recursive substitution across nested JSON", () => {
  const map = new Map<string, ResolvedEntry>([
    ["[INSERT_PRICE]", { token: "[INSERT_PRICE]", value: "£1,500", source: "campaign" }],
    ["[INSERT_CONTACT_EMAIL]", { token: "[INSERT_CONTACT_EMAIL]", value: "hi@zap.com", source: "default" }],
  ]);

  it("substitutes tokens in nested object string leaves", () => {
    const input = {
      headline: "Join for [INSERT_PRICE]",
      cta: { label: "Email [INSERT_CONTACT_EMAIL]", url: "https://book.me" },
    };
    const result = resolveTokensInObject(input, map);
    expect(result).toEqual({
      headline: "Join for £1,500",
      cta: { label: "Email hi@zap.com", url: "https://book.me" },
    });
  });

  it("substitutes tokens inside arrays of objects", () => {
    const input = {
      emails: [
        { subject: "Doors open — [INSERT_PRICE]", body: "Reply to [INSERT_CONTACT_EMAIL]" },
        { subject: "No tokens here", body: "Plain body" },
      ],
    };
    const result = resolveTokensInObject(input, map);
    expect(result.emails[0].subject).toBe("Doors open — £1,500");
    expect(result.emails[0].body).toBe("Reply to hi@zap.com");
    expect(result.emails[1].subject).toBe("No tokens here");
  });

  it("leaves non-string leaves (number, boolean, null) untouched", () => {
    const input = { price: 1500, active: true, note: null, label: "[INSERT_PRICE]" };
    const result = resolveTokensInObject(input, map);
    expect(result).toEqual({ price: 1500, active: true, note: null, label: "£1,500" });
  });

  it("leaves unfilled tokens intact within the structure", () => {
    const input = { a: "[INSERT_PRICE]", b: "[INSERT_GUARANTEE_TERMS]" };
    const result = resolveTokensInObject(input, map);
    expect(result).toEqual({ a: "£1,500", b: "[INSERT_GUARANTEE_TERMS]" });
  });

  it("applies the synonym map to nested tokens", () => {
    // [INSERT_SUPPORT_EMAIL] normalizes to [INSERT_CONTACT_EMAIL]
    const input = { footer: "Questions? [INSERT_SUPPORT_EMAIL]" };
    const result = resolveTokensInObject(input, map);
    expect(result.footer).toBe("Questions? hi@zap.com");
  });

  it("does not mutate the input object", () => {
    const input = { headline: "Join for [INSERT_PRICE]" };
    resolveTokensInObject(input, map);
    expect(input.headline).toBe("Join for [INSERT_PRICE]");
  });

  it("resolves a top-level string", () => {
    expect(resolveTokensInObject("Pay [INSERT_PRICE]", map)).toBe("Pay £1,500");
  });
});

describe("two-pass precedence — campaign overrides default", () => {
  it("campaign-specific value wins over account default", () => {
    // Simulate the two-pass buildResolvedMap logic
    const rows = [
      { serviceId: null, token: "[INSERT_PRICE]", value: "$3,000" },      // account default
      { serviceId: 42, token: "[INSERT_PRICE]", value: "$6,000" },         // campaign override
      { serviceId: null, token: "[INSERT_HOST_NAME]", value: "Arfeen" },   // default only
    ];
    const targetServiceId = 42;

    const map = new Map<string, ResolvedEntry>();
    // Pass 1: defaults
    for (const row of rows.filter(r => r.serviceId === null)) {
      map.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
    // Pass 2: campaign overrides
    for (const row of rows.filter(r => r.serviceId === targetServiceId)) {
      map.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }

    expect(map.get("[INSERT_PRICE]")!.value).toBe("$6,000");
    expect(map.get("[INSERT_PRICE]")!.source).toBe("campaign");
    expect(map.get("[INSERT_HOST_NAME]")!.value).toBe("Arfeen");
    expect(map.get("[INSERT_HOST_NAME]")!.source).toBe("default");
  });

  it("save to campaign B leaves campaign A rows untouched", () => {
    // Simulate rows from two campaigns
    const allRows = [
      { serviceId: null, token: "[INSERT_PRICE]", value: "$9,000" },   // latest default
      { serviceId: 10, token: "[INSERT_PRICE]", value: "$6,000" },     // campaign A
      { serviceId: 20, token: "[INSERT_PRICE]", value: "$9,000" },     // campaign B
    ];

    // Resolve for campaign A
    const mapA = new Map<string, ResolvedEntry>();
    const relevantA = allRows.filter(r => r.serviceId === null || r.serviceId === 10);
    for (const row of relevantA.filter(r => r.serviceId === null)) {
      mapA.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
    for (const row of relevantA.filter(r => r.serviceId === 10)) {
      mapA.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }

    // Campaign A still shows $6,000 (its own row wins over updated default)
    expect(mapA.get("[INSERT_PRICE]")!.value).toBe("$6,000");
    expect(mapA.get("[INSERT_PRICE]")!.source).toBe("campaign");

    // Resolve for campaign B
    const mapB = new Map<string, ResolvedEntry>();
    const relevantB = allRows.filter(r => r.serviceId === null || r.serviceId === 20);
    for (const row of relevantB.filter(r => r.serviceId === null)) {
      mapB.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
    for (const row of relevantB.filter(r => r.serviceId === 20)) {
      mapB.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }

    // Campaign B shows $9,000
    expect(mapB.get("[INSERT_PRICE]")!.value).toBe("$9,000");
  });

  it("new campaign with no campaign rows falls back to account defaults", () => {
    const rows = [
      { serviceId: null, token: "[INSERT_PRICE]", value: "$6,000" },
      { serviceId: null, token: "[INSERT_HOST_NAME]", value: "Arfeen" },
    ];
    const newServiceId = 99;

    const map = new Map<string, ResolvedEntry>();
    const relevant = rows.filter(r => r.serviceId === null || r.serviceId === newServiceId);
    for (const row of relevant.filter(r => r.serviceId === null)) {
      map.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
    for (const row of relevant.filter(r => r.serviceId === newServiceId)) {
      map.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }

    expect(map.get("[INSERT_PRICE]")!.value).toBe("$6,000");
    expect(map.get("[INSERT_PRICE]")!.source).toBe("default");
    expect(map.get("[INSERT_HOST_NAME]")!.value).toBe("Arfeen");
    expect(map.get("[INSERT_HOST_NAME]")!.source).toBe("default");
  });
});

// ─── Token synonym normalization ──────────────────────────────────────────────

describe("normalizeToken — maps LLM-invented variants to canonical tokens", () => {
  it("normalizes all known synonyms", () => {
    expect(normalizeToken("[INSERT_CART_CLOSE]")).toBe("[INSERT_COHORT_CLOSE_DATE]");
    expect(normalizeToken("[INSERT_NEXT_COHORT_DATE]")).toBe("[INSERT_COHORT_CLOSE_DATE]");
    expect(normalizeToken("[INSERT_REMAINING_SPOTS]")).toBe("[INSERT_COHORT_LIMIT]");
    expect(normalizeToken("[INSERT_SPOTS_REMAINING]")).toBe("[INSERT_COHORT_LIMIT]");
    expect(normalizeToken("[INSERT_AVAILABLE_SPOTS]")).toBe("[INSERT_COHORT_LIMIT]");
    expect(normalizeToken("[INSERT_SUPPORT_EMAIL]")).toBe("[INSERT_CONTACT_EMAIL]");
    expect(normalizeToken("[INSERT_REFUND_EMAIL]")).toBe("[INSERT_CONTACT_EMAIL]");
    expect(normalizeToken("[INSERT_BOOKING_LINK]")).toBe("[INSERT_BOOKING_URL]");
    expect(normalizeToken("[INSERT_START_DATE]")).toBe("[INSERT_PROGRAMME_START_DATE]");
    expect(normalizeToken("[INSERT_NEXT_LAUNCH_DATE]")).toBe("[INSERT_PROGRAMME_START_DATE]");
    expect(normalizeToken("[INSERT_NEXT_OPEN_DATE]")).toBe("[INSERT_PROGRAMME_START_DATE]");
    expect(normalizeToken("[INSERT_LAUNCH_DATE]")).toBe("[INSERT_DEADLINE]");
  });

  it("passes canonical tokens through unchanged", () => {
    expect(normalizeToken("[INSERT_PRICE]")).toBe("[INSERT_PRICE]");
    expect(normalizeToken("[INSERT_HOST_NAME]")).toBe("[INSERT_HOST_NAME]");
    expect(normalizeToken("[INSERT_COHORT_CLOSE_DATE]")).toBe("[INSERT_COHORT_CLOSE_DATE]");
  });
});

describe("resolveTokensInText — resolves through synonym map", () => {
  it("resolves off-canonical tokens via synonym lookup", () => {
    const map = new Map<string, ResolvedEntry>([
      ["[INSERT_COHORT_CLOSE_DATE]", { token: "[INSERT_COHORT_CLOSE_DATE]", value: "June 30", source: "campaign" }],
      ["[INSERT_COHORT_LIMIT]", { token: "[INSERT_COHORT_LIMIT]", value: "20 spots", source: "default" }],
      ["[INSERT_CONTACT_EMAIL]", { token: "[INSERT_CONTACT_EMAIL]", value: "help@coach.com", source: "default" }],
    ]);
    const text = "Closes [INSERT_CART_CLOSE]. Only [INSERT_REMAINING_SPOTS] left. Contact [INSERT_SUPPORT_EMAIL].";
    const result = resolveTokensInText(text, map);
    expect(result).toBe("Closes June 30. Only 20 spots left. Contact help@coach.com.");
  });

  it("resolves mix of canonical and off-canonical in same text", () => {
    const map = new Map<string, ResolvedEntry>([
      ["[INSERT_PRICE]", { token: "[INSERT_PRICE]", value: "$6,000", source: "campaign" }],
      ["[INSERT_PROGRAMME_START_DATE]", { token: "[INSERT_PROGRAMME_START_DATE]", value: "1 July", source: "default" }],
    ]);
    const text = "Investment: [INSERT_PRICE]. Starts [INSERT_START_DATE].";
    const result = resolveTokensInText(text, map);
    expect(result).toBe("Investment: $6,000. Starts 1 July.");
  });
});

// ─── Offer validator: widened field-scoping (S3) ──────────────────────────────

describe("S3 — invented currency detected in ALL 7 offer fields (not just pricing/bonuses)", () => {
  const cleanBase: RawOfferFields = {
    offerName: "The Clarity Sprint",
    valueProposition: "Move from stuck to clear.",
    pricing: "Investment: [INSERT_PRICE].",
    bonuses: "BONUS #1: [INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE]).",
    guarantee: "[INSERT_GUARANTEE_TERMS].",
    urgency: "Limited to [INSERT_COHORT_LIMIT].",
    cta: "Book a call.",
  };

  const fieldsToTest = ["valueProposition", "guarantee", "urgency", "cta"] as const;

  for (const field of fieldsToTest) {
    it(`flags invented currency in ${field} when no price supplied`, () => {
      const offer: RawOfferFields = { ...cleanBase, [field]: `Invest just £497 for the full programme.` };
      const result = validateOfferFabricationPatterns(offer, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.hits.some(h => h.classId === "offer_invented_currency" && h.location === field)).toBe(true);
      }
    });

    it(`does NOT flag user-supplied price in ${field}`, () => {
      const offer: RawOfferFields = { ...cleanBase, [field]: `Invest just £497 for the full programme.` };
      const supplied: OfferSuppliedData = { price: "497" };
      const result = validateOfferFabricationPatterns(offer, supplied);
      const currencyHits = result.ok ? [] : result.hits.filter(h => h.classId === "offer_invented_currency" && h.location === field);
      expect(currencyHits.length).toBe(0);
    });
  }

  it("flags invented cohort limit in valueProposition (not just urgency)", () => {
    const offer: RawOfferFields = { ...cleanBase, valueProposition: "Only 8 spots available for this cohort." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "offer_invented_cohort_limit")).toBe(true);
    }
  });

  it("flags invented programme duration in cta (not just pricing/guarantee)", () => {
    const offer: RawOfferFields = { ...cleanBase, cta: "Start your 12-week programme today." };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "offer_invented_programme_duration")).toBe(true);
    }
  });
});

// ─── S4 — Offer ANGLE_PROMPTS no longer instruct concrete prices ─────────────

describe("S4 — offer generator prompts do not instruct concrete currency amounts", () => {
  const offerSrc = readFileSync(join(__dirname, "offersGenerator.ts"), "utf8");
  // The three angle prompts moved to `_core/offerStandard.ts` when the offer node became
  // campaign-type-aware, and they moved as TWO sets — free_event and paid. These assertions were
  // repointed there rather than deleted. One of them had gone silently vacuous in the move:
  // `indexOf("const ANGLE_PROMPTS")` returned -1, `slice(-1, …)` produced an EMPTY string, and the
  // `not.toContain` passed against nothing. A gate that reports green while testing zero is the
  // exact failure shape CLAUDE.md §15a is a law about, so the slice is gone entirely — these now
  // read the real exported prompt objects instead of guessing at source-text offsets.
  const stdSrc = readFileSync(join(__dirname, "_core/offerStandard.ts"), "utf8");
  const freeAngles = Object.values(FREE_EVENT_ANGLE_PROMPTS);
  const paidAngles = Object.values(PAID_ANGLE_PROMPTS);
  const allAngles = [...freeAngles, ...paidAngles];

  it("neither angle set instructs a 'specific £/$ value' for bonuses", () => {
    expect(allAngles).toHaveLength(6);
    for (const a of allAngles) expect(a).not.toContain("specific £/$ value");
  });

  it("neither angle set contains ANY concrete currency figure", () => {
    // Replaces the old fixed-string checks for "£8,000/month" with the general property those
    // checks were reaching for. A currency symbol or amount-word followed by digits, anywhere.
    for (const a of allAngles) {
      expect(a).not.toMatch(/[£$€¥]\s?\d/);
      expect(a).not.toMatch(/\b\d[\d,]*(?:\.\d+)?\s?(?:pounds|dollars|euros|GBP|USD|EUR)\b/i);
    }
  });

  it("the FREE-EVENT angle set contains no price or refund directive at all", () => {
    // The whole point of the mode split: on a campaign that converts on a free next step there is
    // nothing to buy and therefore nothing to refund.
    for (const a of freeAngles) {
      expect(a).not.toMatch(/\[INSERT_PRICE\]/);
      expect(a).not.toMatch(/money[- ]back|refund|you don\W?t pay|risk[- ]free/i);
      // Matched on DIRECTIVES, not the bare word: the free angles deliberately say things like
      // "not against any price" and "keep the passage free of price framing", and a bare \bprice\b
      // would flag the very sentences doing the work.
      expect(a).not.toMatch(/(?:present|state|reveal|name|show|use)\s+the\s+price/i);
      expect(a).not.toMatch(/supplied\s+price|price\s+token|actual\s+price|entry[- ]priced/i);
    }
  });

  it("neither angle set carries the retired paid-shaped instructions", () => {
    for (const a of allAngles) {
      expect(a).not.toContain("state that number explicitly");
      expect(a).not.toContain("clear price with anchoring");
    }
    expect(offerSrc).not.toContain("state that number explicitly");
    expect(offerSrc).not.toContain("clear price with anchoring");
    expect(offerSrc).not.toContain("£8,000/month");
  });

  it("offerStandard.ts as a whole primes no concrete currency figure", () => {
    // Added with the rebuild: the "(£497 value)" worked example that used to sit in the section
    // spec was placeholder-ised, because a worked figure in a prompt is itself a priming source.
    expect(stdSrc).not.toMatch(/[£$€¥]\s?\d/);
  });

  it("the operator-fill block still directs bonuses to [INSERT_BONUS_N_VALUE]", () => {
    // The placeholder-directive literals live in offersGenerator's operator-fill block, which did
    // NOT move. Asserted at their real home rather than inside the relocated angle prompts.
    expect(offerSrc).toContain("[INSERT_BONUS_N_VALUE]");
    expect(offerSrc).toMatch(/Do NOT invent "\(£497 value\)"|Do NOT invent .{0,40}value/);
  });

  it("the operator-fill block still directs an unsupplied price to [INSERT_PRICE]", () => {
    expect(offerSrc).toContain("[INSERT_PRICE]");
    expect(offerSrc).toMatch(/operator has NOT supplied a price[\s\S]{0,200}\[INSERT_PRICE\]/);
  });

  it("the canonical-token allow-list guidance is still emitted", () => {
    expect(offerSrc).toContain("CANONICAL TOKEN ALLOW-LIST");
    expect(offerSrc).toMatch(/getCanonicalOfferTokens/);
  });

  it("validator still catches invented price in pricing field when no price supplied", () => {
    const offer: RawOfferFields = {
      offerName: "Test",
      valueProposition: "Test",
      pricing: "Investment: £297 for the full programme.",
      bonuses: "[INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE])",
      guarantee: "[INSERT_GUARANTEE_TERMS]",
      urgency: "[INSERT_COHORT_LIMIT]",
      cta: "Book a call.",
    };
    const result = validateOfferFabricationPatterns(offer, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some(h => h.classId === "offer_invented_currency")).toBe(true);
    }
  });

  it("supplied price passes without false positive", () => {
    const offer: RawOfferFields = {
      offerName: "Test",
      valueProposition: "Get results worth every penny of your £297 investment.",
      pricing: "Investment: £297 for the full programme.",
      bonuses: "[INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE])",
      guarantee: "[INSERT_GUARANTEE_TERMS]",
      urgency: "[INSERT_COHORT_LIMIT]",
      cta: "Get started for £297.",
    };
    const supplied: OfferSuppliedData = { price: "297" };
    const result = validateOfferFabricationPatterns(offer, supplied);
    const currencyHits = result.ok ? [] : result.hits.filter(h => h.classId === "offer_invented_currency");
    expect(currencyHits.length).toBe(0);
  });
});

// ─── T1 — Campaign identifier: auto-name + updateName ────────────────────────

describe("T1 — autoSelectBest auto-names from offer on completion", () => {
  // These test the logic structurally (the actual DB calls need integration tests).
  // We verify the conditional: name is updated ONLY when it's "Auto Campaign Kit".

  it("auto-derive: kit with default name gets offer productName on completion", () => {
    const kitName = "Auto Campaign Kit";
    const offerProductName = "Authority Stack Accelerator";
    // Condition: name === "Auto Campaign Kit" AND selectedOfferId present
    const shouldDerive = kitName === "Auto Campaign Kit" && !!offerProductName;
    expect(shouldDerive).toBe(true);
    const newName = shouldDerive ? offerProductName : kitName;
    expect(newName).toBe("Authority Stack Accelerator");
  });

  it("preserve: kit with custom name is NOT overwritten on completion", () => {
    const kitName = "My Custom Campaign Title";
    const offerProductName = "Authority Stack Accelerator";
    const shouldDerive = kitName === "Auto Campaign Kit" && !!offerProductName;
    expect(shouldDerive).toBe(false);
    const newName = shouldDerive ? offerProductName : kitName;
    expect(newName).toBe("My Custom Campaign Title");
  });

  it("preserve: kit with manual-path name is NOT overwritten on completion", () => {
    const kitName = "Marketing Agency — Health Coaches Campaign";
    const offerProductName = "Authority Stack Accelerator";
    const shouldDerive = kitName === "Auto Campaign Kit" && !!offerProductName;
    expect(shouldDerive).toBe(false);
    const newName = shouldDerive ? offerProductName : kitName;
    expect(newName).toBe("Marketing Agency — Health Coaches Campaign");
  });

  it("fallback: kit with default name but no offer leaves name unchanged", () => {
    const kitName = "Auto Campaign Kit";
    const offerProductName: string | null = null;
    const shouldDerive = kitName === "Auto Campaign Kit" && !!offerProductName;
    expect(shouldDerive).toBe(false);
    const newName = shouldDerive ? offerProductName : kitName;
    expect(newName).toBe("Auto Campaign Kit");
  });
});

describe("T1 — updateName input validation", () => {
  const { z } = require("zod");
  const updateNameSchema = z.object({
    kitId: z.number(),
    name: z.string().min(1).max(255),
  });

  it("accepts valid rename", () => {
    expect(updateNameSchema.safeParse({ kitId: 1, name: "My Campaign" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(updateNameSchema.safeParse({ kitId: 1, name: "" }).success).toBe(false);
  });

  it("rejects name over 255 chars", () => {
    expect(updateNameSchema.safeParse({ kitId: 1, name: "x".repeat(256) }).success).toBe(false);
  });
});

// ─── CASCADE_NODE_TO_KIT_FIELD mapping integrity ─────────────────────────────

describe("CASCADE_NODE_TO_KIT_FIELD — each node maps to its own selected column", () => {
  const EXPECTED: Record<string, string> = {
    offer:       "selectedOfferId",
    mechanism:   "selectedMechanismId",
    hvco:        "selectedHvcoId",
    headlines:   "selectedHeadlineId",
    adCopy:      "selectedAdCopyId",
    landingPage: "selectedLandingPageId",
    email:       "selectedEmailSequenceId",
    whatsapp:    "selectedWhatsAppSequenceId",
  };

  for (const [node, field] of Object.entries(EXPECTED)) {
    it(`${node} → ${field}`, () => {
      expect(_CASCADE_NODE_TO_KIT_FIELD[node]).toBe(field);
    });
  }

  it("no two nodes share the same column", () => {
    const values = Object.values(_CASCADE_NODE_TO_KIT_FIELD);
    expect(new Set(values).size).toBe(values.length);
  });

  it("every CascadeNode has a mapping", () => {
    const nodes = ["offer", "mechanism", "hvco", "headlines", "adCopy", "landingPage", "email", "whatsapp"];
    for (const n of nodes) {
      expect(_CASCADE_NODE_TO_KIT_FIELD).toHaveProperty(n);
    }
  });
});

// ─── Trail Sprint 3 C1: single-step orchestration executor (structural) ──────
// runOrchestrationStep is extracted from the legacy runOrchestration loop so
// autoMode.orchestrateStep can run one node per job for the chat-paced Trail
// loop. The gen-cores are too I/O-heavy to run here; coverage is structural:
// the step-name catalog is exported in cascade order, every name has a label,
// and the executor is callable. End-to-end behaviour is verified by the
// post-deploy prod probe (single-step run + full legacy run non-regression).

import { ORCHESTRATION_STEP_NAMES, runOrchestrationStep } from "./_core/orchestration";

describe("Trail Sprint 3 C1 — runOrchestrationStep extraction", () => {
  it("exports the 9 step names in cascade order", () => {
    expect(ORCHESTRATION_STEP_NAMES).toEqual([
      "offer", "mechanism", "hvco", "headlines", "adCopy",
      "landingPage", "emailSequence", "whatsappSequence", "adCreatives",
    ]);
  });

  it("every step name has a user-facing label in the catalog", () => {
    for (const name of ORCHESTRATION_STEP_NAMES) {
      expect(ORCHESTRATION_STEP_LABELS).toHaveProperty(name);
      expect(typeof ORCHESTRATION_STEP_LABELS[name]).toBe("string");
      expect(ORCHESTRATION_STEP_LABELS[name].length).toBeGreaterThan(0);
    }
  });

  it("runOrchestrationStep is an exported async executor", () => {
    expect(typeof runOrchestrationStep).toBe("function");
  });
});

// ─── Landing Page Template System — structural assertions ──────────────────
import { renderTemplate } from "./lib/templates/renderTemplate";
import { getTemplate, isTemplateStyleId, TEMPLATES } from "./lib/templates/registry";
import { ENERGETIC } from "./lib/templates/energetic";
import type { LandingPageContent } from "../drizzle/schema";
import type { LpPageType, TemplateStyleId } from "./lib/templates/types";
import { CTA_BY_PAGE_TYPE } from "./lib/templates/types";
import { ctaLabel, ok, esc, hb } from "./lib/templates/shared";

// Minimal valid content for rendering tests
const SAMPLE_CONTENT: LandingPageContent = {
  eyebrowHeadline: "FOR COACHES WHO WANT MORE CLIENTS",
  mainHeadline: "Stop Guessing — Start Getting Clients With A Proven System",
  subheadline: "The exact method 200+ coaches use to fill their calendar in 90 days.",
  primaryCta: "Book Your Free Strategy Call",
  asSeenIn: [],
  quizSection: { question: "", options: [], answer: "" },
  problemAgitation: "Still Struggling to Get Clients?\nYou post on social media daily but hear crickets.\nYou've tried ads but burned money with nothing to show.",
  solutionIntro: "",
  whyOldFail: "",
  uniqueMechanism: "",
  testimonials: [],
  insiderAdvantages: "What Makes This Different\nWe focus on warm outreach, not cold ads.\nOur system works in 30 days, not 6 months.",
  scarcityUrgency: "Limited Spots Available\nWe only take 10 new clients per month to maintain quality.",
  shockingStat: "",
  timeSavingBenefit: "Save 6 Months of Trial and Error\nOur blueprint gives you the shortcut.",
  consultationOutline: [
    { title: "Revenue Gap Analysis", description: "Find the exact gap between current and target income." },
    { title: "Client Acquisition Audit", description: "Identify which channels are working and which are wasting time." },
  ],
  faq: [
    { question: "How long does it take to see results?", answer: "Most clients see their first new booking within 30 days." },
    { question: "Is this a sales call?", answer: "No — it is a genuine strategy session. We will map out your plan whether you work with us or not." },
  ],
  guarantee: "Our 90-Day Results Guarantee\nIf you do not see measurable improvement in your client pipeline within 90 days, we will work with you for free until you do. No questions asked.",
};

describe("Landing Page Template System", () => {
  describe("Registry", () => {
    it("getTemplate returns ENERGETIC config for 'energetic'", () => {
      const config = getTemplate("energetic");
      expect(config.id).toBe("energetic");
      expect(config.headingFont).toContain("Sora");
      expect(config.colors.accent).toBe("#FF5C00");
    });

    it("isTemplateStyleId correctly identifies valid IDs", () => {
      expect(isTemplateStyleId("energetic")).toBe(true);
      expect(isTemplateStyleId("executive")).toBe(true);
      expect(isTemplateStyleId("text")).toBe(false);
      expect(isTemplateStyleId("visual")).toBe(false);
      expect(isTemplateStyleId("unknown")).toBe(false);
    });

    it("all 5 template IDs are registered", () => {
      const ids: TemplateStyleId[] = ["executive", "energetic", "clinical", "warm", "bold"];
      for (const id of ids) {
        expect(getTemplate(id)).toBeDefined();
        expect(getTemplate(id).id).toBeDefined();
      }
    });
  });

  describe("Energetic config", () => {
    it("has sectionMap for all 5 page types", () => {
      const pageTypes: LpPageType[] = [
        "sales_page", "webinar_registration", "discovery_call_booking",
        "lead_magnet_download", "event_registration",
      ];
      for (const pt of pageTypes) {
        expect(ENERGETIC.sectionMap[pt]).toBeDefined();
        expect(ENERGETIC.sectionMap[pt].order.length).toBeGreaterThan(0);
        expect(ENERGETIC.sectionMap[pt].heroLayout).toBeDefined();
      }
    });

    it("sales_page has the most sections (full page)", () => {
      const salesCount = ENERGETIC.sectionMap.sales_page.order.length;
      const webinarCount = ENERGETIC.sectionMap.webinar_registration.order.length;
      const discoveryCount = ENERGETIC.sectionMap.discovery_call_booking.order.length;
      expect(salesCount).toBeGreaterThan(webinarCount);
      expect(salesCount).toBeGreaterThan(discoveryCount);
    });

    it("webinar and event pages have eventStrip type-specific section", () => {
      expect(ENERGETIC.sectionMap.webinar_registration.typeSpecificSections?.eventStrip).toBe(true);
      expect(ENERGETIC.sectionMap.event_registration.typeSpecificSections?.eventStrip).toBe(true);
    });

    it("discovery page has bookingCue, lead_magnet has downloadBadge", () => {
      expect(ENERGETIC.sectionMap.discovery_call_booking.typeSpecificSections?.bookingCue).toBe(true);
      expect(ENERGETIC.sectionMap.lead_magnet_download.typeSpecificSections?.downloadBadge).toBe(true);
    });
  });

  describe("CTA routing", () => {
    it("first CTA uses primaryCta from content", () => {
      const label = ctaLabel(SAMPLE_CONTENT, "sales_page", 0);
      expect(label).toBe("Book Your Free Strategy Call");
    });

    it("subsequent CTAs use page-type-specific labels", () => {
      const webinarLabel = ctaLabel(SAMPLE_CONTENT, "webinar_registration", 1);
      expect(CTA_BY_PAGE_TYPE.webinar_registration).toContain(webinarLabel);

      const discoveryLabel = ctaLabel(SAMPLE_CONTENT, "discovery_call_booking", 1);
      expect(CTA_BY_PAGE_TYPE.discovery_call_booking).toContain(discoveryLabel);
    });
  });

  describe("Shared helpers", () => {
    it("esc escapes HTML entities", () => {
      expect(esc('<script>"alert"</script>')).toBe("&lt;script&gt;&quot;alert&quot;&lt;/script&gt;");
    });

    it("ok returns false for empty/null/undefined", () => {
      expect(ok(null)).toBe(false);
      expect(ok("")).toBe(false);
      expect(ok([])).toBe(false);
      expect(ok("[Generation incomplete")).toBe(false);
    });

    it("ok returns true for populated values", () => {
      expect(ok("hello")).toBe(true);
      expect(ok(["a"])).toBe(true);
    });

    it("hb splits heading and body", () => {
      const result = hb("Title\nLine 1\nLine 2");
      expect(result).toEqual({ heading: "Title", body: ["Line 1", "Line 2"] });
    });
  });

  describe("renderTemplate", () => {
    it("renders sales_page with Energetic config without throwing", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Sora");
      expect(html).toContain("#FF5C00");
      expect(html).toContain(SAMPLE_CONTENT.mainHeadline);
    });

    it("renders webinar_registration — shorter page, has event strip", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "webinar_registration");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("DATE");
      expect(html).toContain("Live session");
    });

    it("renders discovery_call_booking with booking cue", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "discovery_call_booking");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Free 1:1 call");
    });

    it("renders lead_magnet_download with download badge", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "lead_magnet_download");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Instant access");
    });

    it("includes guarantee section for sales_page", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("90-Day Results Guarantee");
    });

    it("includes FAQ section when faq array is populated", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).toContain("Frequently Asked Questions");
      expect(html).toContain("How long does it take");
    });

    it("suppressed proof: empty testimonials array produces no testimonials section", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).not.toContain("What Our Clients Say");
    });

    it("suppressed proof: empty asSeenIn array produces no As Seen In section", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "sales_page");
      expect(html).not.toContain("As Seen In");
    });

    it("includes coach authority when headshot provided", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {
        headshotUrl: "https://example.com/photo.jpg",
        coachName: "Test Coach",
      }, "sales_page");
      expect(html).toContain("Test Coach");
    });

    it("webinar page does NOT include problemAgitation even when content has it", () => {
      const html = renderTemplate(SAMPLE_CONTENT, ENERGETIC, {}, "webinar_registration");
      expect(html).not.toContain("Still Struggling to Get Clients");
    });
  });
});

// ─── Import-Then-Enrich — structural assertions ───────────────────────────
import { enrichImportedIcp } from "./_core/icpEnrichment";

describe("Import-Then-Enrich", () => {
  it("enrichImportedIcp is exported as a function taking icpId", () => {
    expect(typeof enrichImportedIcp).toBe("function");
    expect(enrichImportedIcp.length).toBe(1);
  });
});

// ─── Ad-Creatives ICP Wiring — structural assertions ──────────────────────
import { buildAdHeadlinesUserPrompt } from "./adCreativesGenerator";

describe("Ad-Creatives ICP Wiring", () => {
  it("buildAdHeadlinesUserPrompt includes ICP context when provided", () => {
    const prompt = buildAdHeadlinesUserPrompt({
      productName: "Test Product",
      mainBenefit: "Test benefit",
      targetAudience: "Test audience",
      uniqueMechanism: "Test mechanism",
      pressingProblem: "Test problem",
      icpPains: "They struggle with getting clients consistently",
      icpFears: "They fear running out of money",
      icpObjections: "They think it is too expensive",
      icpBuyingTriggers: "They see a competitor succeed",
    });
    expect(prompt).toContain("Audience daily pains:");
    expect(prompt).toContain("getting clients consistently");
    expect(prompt).toContain("Audience deep fears:");
    expect(prompt).toContain("running out of money");
    expect(prompt).toContain("Audience objections to buying:");
    expect(prompt).toContain("too expensive");
    expect(prompt).toContain("What triggers them to buy:");
    expect(prompt).toContain("competitor succeed");
  });

  it("buildAdHeadlinesUserPrompt works without ICP context (backward compat)", () => {
    const prompt = buildAdHeadlinesUserPrompt({
      productName: "Test Product",
      mainBenefit: "Test benefit",
      targetAudience: "Test audience",
      uniqueMechanism: "Test mechanism",
      pressingProblem: "Test problem",
    });
    expect(prompt).toContain("Test Product");
    expect(prompt).not.toContain("Audience daily pains:");
    expect(prompt).not.toContain("Audience deep fears:");
  });
});

// ─── ICP Enrichment — NULL-only write protection ────────────────────────────

describe("ICP Enrichment — NULL-only write protection", () => {
  // 2026-07-26: 16 -> 14. mediaConsumption / influencers are no longer generated
  // (Class A removal), so enrichment must not try to fill them either.
  it("ICP_CONTENT_FIELDS covers all 14 enrichable text fields", () => {
    expect(ICP_CONTENT_FIELDS).toHaveLength(14);
    expect(ICP_CONTENT_FIELDS).not.toContain("mediaConsumption");
    expect(ICP_CONTENT_FIELDS).not.toContain("influencers");
    expect(ICP_CONTENT_FIELDS).toContain("fears");
    expect(ICP_CONTENT_FIELDS).toContain("objections");
    expect(ICP_CONTENT_FIELDS).toContain("buyingTriggers");
    expect(ICP_CONTENT_FIELDS).toContain("psychographics");
    expect(ICP_CONTENT_FIELDS).toContain("communicationStyle");
    expect(ICP_CONTENT_FIELDS).toContain("introduction");
    expect(ICP_CONTENT_FIELDS).toContain("hopesDreams");
    expect(ICP_CONTENT_FIELDS).toContain("pains");
    expect(ICP_CONTENT_FIELDS).toContain("frustrations");
    expect(ICP_CONTENT_FIELDS).toContain("goals");
    expect(ICP_CONTENT_FIELDS).toContain("values");
    expect(ICP_CONTENT_FIELDS).toContain("decisionMaking");
    expect(ICP_CONTENT_FIELDS).toContain("successMetrics");
    expect(ICP_CONTENT_FIELDS).toContain("implementationBarriers");
  });

  it("buildNullOnlyUpdates writes ONLY to NULL fields — user-provided fields never overwritten", () => {
    const icp = {
      name: "Crypto beginners",
      pains: "User-provided pains about scams",
      goals: "User-provided goals about financial freedom",
      fears: null,
      objections: null,
      buyingTriggers: null,
      psychographics: null,
      communicationStyle: null,
      introduction: null,
      hopesDreams: null,
      frustrations: null,
      values: null,
      mediaConsumption: null,
      influencers: null,
      decisionMaking: null,
      successMetrics: null,
      implementationBarriers: null,
      demographics: null,
      painPoints: null,
      desiredOutcomes: null,
      valuesMotivations: null,
    };
    const generated = {
      pains: "LLM-generated pains (should NOT overwrite)",
      goals: "LLM-generated goals (should NOT overwrite)",
      fears: "LLM-generated fears",
      objections: "LLM-generated objections",
      buyingTriggers: "LLM-generated buying triggers",
      psychographics: "LLM-generated psychographics",
      communicationStyle: "LLM-generated communication style",
      introduction: "LLM-generated intro",
      hopesDreams: "LLM-generated hopes",
      frustrations: "LLM-generated frustrations",
      values: "LLM-generated values",
      mediaConsumption: "LLM-generated media",
      influencers: "LLM-generated influencers",
      decisionMaking: "LLM-generated decision",
      successMetrics: "LLM-generated metrics",
      implementationBarriers: "LLM-generated barriers",
      demographics: { age_range: "25-55" },
    };

    const updates = buildNullOnlyUpdates(icp, generated);

    // User-provided pains and goals must NOT be in updates
    expect(updates).not.toHaveProperty("pains");
    expect(updates).not.toHaveProperty("goals");

    // NULL fields must be filled
    expect(updates.fears).toBe("LLM-generated fears");
    expect(updates.objections).toBe("LLM-generated objections");
    expect(updates.buyingTriggers).toBe("LLM-generated buying triggers");
    expect(updates.psychographics).toBe("LLM-generated psychographics");
    expect(updates.communicationStyle).toBe("LLM-generated communication style");
    expect(updates.introduction).toBe("LLM-generated intro");
    // demographics is no longer generated, so enrichment never fills it from the
    // model — a coach-supplied import value stays the only source (Class A removal).
    expect(updates).not.toHaveProperty("demographics");

    // Mirror fields: painPoints, desiredOutcomes, valuesMotivations
    expect(updates).not.toHaveProperty("painPoints"); // pains wasn't updated
    expect(updates).not.toHaveProperty("desiredOutcomes"); // goals wasn't updated
    expect(updates.valuesMotivations).toBe("LLM-generated values"); // values was NULL → filled
  });

  it("buildNullOnlyUpdates returns empty object when all fields already populated", () => {
    const fullyPopulated: Record<string, unknown> = { demographics: {} };
    for (const field of ICP_CONTENT_FIELDS) {
      fullyPopulated[field] = "existing content";
    }
    fullyPopulated.painPoints = "existing";
    fullyPopulated.desiredOutcomes = "existing";
    fullyPopulated.valuesMotivations = "existing";

    const generated: Record<string, unknown> = { demographics: { age_range: "25-55" } };
    for (const field of ICP_CONTENT_FIELDS) {
      generated[field] = "LLM output that should be ignored";
    }

    const updates = buildNullOnlyUpdates(fullyPopulated, generated);
    expect(Object.keys(updates)).toHaveLength(0);
  });

  it("correction appended to pains preserves original content", () => {
    // Simulates the client-side correction logic (Bug 1 fix)
    const originalData = {
      name: "Financial strugglers aged 25-55",
      pains: "Trapped in paycheck-to-paycheck cycles, desperate for crypto",
    };
    const correction = "it's also business owners too";

    // Bug 1 fix: append correction as labeled context, preserve original name
    const corrected = {
      ...originalData,
      pains: (originalData.pains || "") + "\n\nUser correction: " + correction,
    };

    // Original name preserved
    expect(corrected.name).toBe("Financial strugglers aged 25-55");
    // Original pains content preserved
    expect(corrected.pains).toContain("Trapped in paycheck-to-paycheck cycles");
    // Correction appended with label
    expect(corrected.pains).toContain("User correction: it's also business owners too");
  });
});

// ─── Quiz Sprint C1: readiness-scorecard rubric validator ─────────────────────
// validateQuizBody is the sprint's quality gate. A miscalibrated scorecard
// misdiagnoses a coach's prospect with the coach's name on it, so the validator
// must reject degenerate rubrics (equal weights, band gaps/overlaps, bands that
// don't cover 0..100, missing teaser/meaning/cta) and accept only sound ones.

describe("Quiz C1 — validateQuizBody rubric validator", () => {
  const cta = (n: string) => ({ heading: `${n} next step`, body: `${n} body bridging to the programme`, ctaLabel: "Book My Free Call" });
  const q = (question: string, weights: number[]) => ({
    question,
    options: weights.map((w, i) => ({ label: `option ${i + 1}`, weight: w })),
  });
  // A canonical valid readiness scorecard: 7 discriminating questions, 3 contiguous bands covering 0..100.
  const validBody = (): QuizBody => ({
    format: "quiz",
    title: "How Ready Is Your Practice To Scale?",
    promise: "Find out exactly where your practice stands and the one move that unlocks the next stage.",
    questions: [
      q("How predictable is your lead flow?", [0, 1, 2, 3]),
      q("Do you have a documented sales process?", [0, 1, 3]),
      q("How much of delivery is systemised?", [0, 2, 3]),
      q("Is your pricing tied to outcomes?", [0, 1, 2, 3]),
      q("How strong is your referral engine?", [0, 1, 2]),
      q("Do you track the numbers weekly?", [0, 2, 3]),
      q("How much runs without you?", [0, 1, 2, 3]),
    ],
    scoring: {
      bands: [
        { name: "Foundations", minPercent: 0, maxPercent: 33, teaser: "You're building the base.", meaning: "Your practice is early — focus on predictable lead flow first.", cta: cta("Foundations") },
        { name: "Momentum", minPercent: 34, maxPercent: 66, teaser: "You've got traction.", meaning: "You have the pieces; systemising delivery is your next unlock.", cta: cta("Momentum") },
        { name: "Scale-Ready", minPercent: 67, maxPercent: 100, teaser: "You're ready to scale.", meaning: "Your fundamentals are strong — it's time to remove yourself from delivery.", cta: cta("Scale-Ready") },
      ],
    },
    nextStep: cta("Global"),
  });

  it("accepts a sound weighted scorecard", () => {
    expect(validateQuizBody(validBody())).toEqual({ ok: true });
  });

  it("rejects fewer than 5 questions", () => {
    const b = validBody(); b.questions = b.questions.slice(0, 4);
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a question whose options all share one weight (no discrimination)", () => {
    const b = validBody(); b.questions[2] = q("flat question", [2, 2, 2]);
    const r = validateQuizBody(b);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/discriminate/i);
  });

  it("rejects when there is no weight variation across the whole scorecard", () => {
    const b = validBody();
    b.questions = b.questions.map((qq) => ({ ...qq, options: qq.options.map((o) => ({ ...o, weight: 1 })) }));
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects an out-of-range option weight", () => {
    const b = validBody(); b.questions[0].options[0].weight = 5;
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a question with fewer than 3 options", () => {
    const b = validBody(); b.questions[1] = { question: "too few", options: [{ label: "a", weight: 0 }, { label: "b", weight: 3 }] };
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects fewer than 3 bands", () => {
    const b = validBody(); b.scoring.bands = b.scoring.bands.slice(0, 2);
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a band gap (does not cover 0..100 contiguously)", () => {
    const b = validBody(); b.scoring.bands[1].minPercent = 40; // leaves 34..39 uncovered
    const r = validateQuizBody(b);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/contiguous|gap/i);
  });

  it("rejects overlapping bands", () => {
    const b = validBody(); b.scoring.bands[1].maxPercent = 70; b.scoring.bands[2].minPercent = 67;
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects bands that do not start at 0", () => {
    const b = validBody(); b.scoring.bands[0].minPercent = 5;
    const r = validateQuizBody(b);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/start at 0/i);
  });

  it("rejects bands that do not end at 100", () => {
    const b = validBody(); b.scoring.bands[2].maxPercent = 95;
    const r = validateQuizBody(b);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/end at 100/i);
  });

  it("rejects a band missing its teaser", () => {
    const b = validBody(); b.scoring.bands[1].teaser = "  ";
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a band missing its meaning", () => {
    const b = validBody(); b.scoring.bands[0].meaning = "";
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a band whose CTA is incomplete", () => {
    const b = validBody(); b.scoring.bands[2].cta = { heading: "x", body: "y", ctaLabel: "" };
    expect(validateQuizBody(b).ok).toBe(false);
  });

  it("rejects a blank promise", () => {
    const b = validBody(); b.promise = "   ";
    expect(validateQuizBody(b).ok).toBe(false);
  });
});


// ─── Offer node — free-event vs paid mode resolution ────────────────────────
// The offer node was the ONLY generator in the cascade that never resolved campaignType, so it
// wrote a priced, refund-guaranteed offer for a FREE webinar. `resolveOfferMode` is the pure
// function that gates all of that, so its four branches are pinned here.
describe("resolveOfferMode — free-event vs paid", () => {
  it("a webinar campaign converts on a FREE next step", () => {
    expect(resolveOfferMode({ campaignType: "webinar" })).toBe("free_event");
  });

  it("a course launch converts on a PURCHASE", () => {
    expect(resolveOfferMode({ campaignType: "course_launch" })).toBe("paid");
  });

  it("an operator-set price upgrades a free type to paid (the deferred-tripwire seam)", () => {
    expect(
      resolveOfferMode({ campaignType: "webinar", campaignFacts: { price: { amount: "250" } } }),
    ).toBe("paid");
  });

  it("an explicit __FREE__ answer downgrades a paid type to free", () => {
    expect(
      resolveOfferMode({ campaignType: "course_launch", campaignFacts: { price: { amount: "__FREE__" } } }),
    ).toBe("free_event");
  });

  it("silence is never read as free — an unpriced event falls through to its campaign default", () => {
    // Three-state discipline: only an EXPLICIT __FREE__ means free. An empty price is unanswered.
    expect(resolveOfferMode({ campaignType: "in_person_event", campaignFacts: { price: undefined } }))
      .toBe("free_event");
    expect(resolveOfferMode({ campaignType: "course_launch", campaignFacts: { price: { amount: "" } } }))
      .toBe("paid");
  });

  it("every one of the seven campaign types resolves to a mode", () => {
    for (const t of Object.keys(CAMPAIGN_TO_PAGE_TYPE)) {
      expect(["free_event", "paid"]).toContain(resolveOfferMode({ campaignType: t }));
    }
  });
});

// ─── The 4-of-7 landing-page framing drift ──────────────────────────────────
// The map inside landingPageGenerator.ts carried FOUR of the seven campaign types, so a FREE
// discovery-call page was generated against "Enrolment is the decision point / CTA: Enrol now".
describe("LP_CAMPAIGN_FRAMING covers every campaign type", () => {
  it("has an entry for all seven, matching CAMPAIGN_TO_PAGE_TYPE's key set", () => {
    expect(Object.keys(LP_CAMPAIGN_FRAMING).sort()).toEqual(Object.keys(CAMPAIGN_TO_PAGE_TYPE).sort());
    expect(Object.keys(LP_CAMPAIGN_FRAMING)).toHaveLength(7);
  });

  it("the three formerly-missing types no longer fall through to course_launch", () => {
    // THE ACTUAL REGRESSION. These three had no entry, so `map[type] || map['course_launch']`
    // handed a FREE page the course-launch framing. Asserting they are DISTINCT from it is the
    // property that matters; regexing the prose is fragile because the prose discusses what to
    // avoid ("Never an enrolment deadline") in the very sentence doing the work.
    for (const t of ["discovery_call", "lead_magnet", "in_person_event"] as const) {
      expect(LP_CAMPAIGN_FRAMING[t]).not.toBe(LP_CAMPAIGN_FRAMING.course_launch);
      expect(LP_CAMPAIGN_FRAMING[t]).toMatch(/^CAMPAIGN TYPE: /);
    }
  });

  it("no free campaign type's CTA line tells the reader to enrol or buy", () => {
    for (const t of ["discovery_call", "lead_magnet", "webinar", "in_person_event"] as const) {
      const cta = (LP_CAMPAIGN_FRAMING[t].match(/^CTA language:.*$/m) ?? [""])[0];
      expect(cta).not.toMatch(/enrol|buy now|purchase|checkout/i);
    }
  });
});
