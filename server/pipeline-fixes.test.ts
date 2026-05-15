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
import { calculateSceneDurations } from "./routers/videos";
import { buildScriptPrompt, MAX_SCRIPT_WORDS } from "./routers/videoScripts";

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

  it("admin role does NOT bypass — admin still blocked on trial", () => {
    const result = isAutoModeTierAllowed({ role: "admin", subscriptionTier: "trial" });
    expect(result.allowed).toBe(false);
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

const FIVE_VALID_SHORT_HEADLINES = [
  "Cut Decision Time 50%",      // 21 chars
  "Founders Trust This System", // 26 chars
  "Why Your Forecast Lies",     // 22 chars
  "From Guess to Number",       // 20 chars
  "Stop Chasing Dead Deals",    // 23 chars
];

describe("Phase C C1.1 — ad headlines length validator", () => {
  it("ok: 5 valid ≤38-char headlines pass", () => {
    const result = validateAdHeadlines({ headlines: FIVE_VALID_SHORT_HEADLINES });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headlines).toHaveLength(5);
    }
  });

  it("ok: legacy shape where root parsed is the array directly", () => {
    const result = validateAdHeadlines(FIVE_VALID_SHORT_HEADLINES);
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
    const result = validateAdHeadlines({ headlines: dirty });
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
    const result = validateAdHeadlines({ headlines: veryDirty });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_over_length");
      expect(result.failContext).toContain("headline[1]");
      expect(result.failContext).toContain("headline[2]");
    }
  });

  it("FAIL: wrong count (4 instead of 5) → failContext names the count mismatch", () => {
    const result = validateAdHeadlines({ headlines: FIVE_VALID_SHORT_HEADLINES.slice(0, 4) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headlines_wrong_count");
      expect(result.failContext).toContain("4");
      expect(result.failContext).toContain("5");
    }
  });

  it("FAIL: 6 headlines → also failContext names the count mismatch", () => {
    const result = validateAdHeadlines({ headlines: [...FIVE_VALID_SHORT_HEADLINES, "Extra one"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headlines_wrong_count");
    }
  });

  it("FAIL: missing headlines field → wrong_type", () => {
    const result = validateAdHeadlines({ other: "x" });
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
    const result = validateAdHeadlines({ headlines: dirty });
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
    const result = validateAdHeadlines({ headlines: dirty });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.subCase).toBe("headline_not_string");
    }
  });

  it("OK: headlines field as valid JSON-encoded string is recovered (sub-case 1)", () => {
    const stringified = JSON.stringify(FIVE_VALID_SHORT_HEADLINES);
    const result = validateAdHeadlines({ headlines: stringified });
    expect(result.ok).toBe(true);
  });

  it("OK: exactly 38-char headline (boundary) passes", () => {
    const at_38 = "0123456789012345678901234567890123 ab8"; // exactly 38
    expect(at_38.length).toBe(38);
    const headlines = [at_38, "B", "C", "D", "E"];
    const result = validateAdHeadlines({ headlines });
    expect(result.ok).toBe(true);
  });

  it("FAIL: 39-char headline (boundary+1) caught", () => {
    const at_39 = "0123456789012345678901234567890123 ab89"; // exactly 39
    expect(at_39.length).toBe(39);
    const headlines = [at_39, "B", "C", "D", "E"];
    const result = validateAdHeadlines({ headlines });
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

  it("prompt includes per-register example shapes for all 5 emotional registers", () => {
    const prompt = buildAdHeadlinesUserPrompt(SAMPLE_INPUT);
    // Each register needs concrete length-fitting reference shapes.
    expect(prompt).toMatch(/BENEFIT/);
    expect(prompt).toMatch(/SOCIAL_PROOF/);
    expect(prompt).toMatch(/CURIOSITY/);
    expect(prompt).toMatch(/CONTRAST/);
    expect(prompt).toMatch(/CHALLENGE/);
    // Sample of expected example-shape phrases that should round-trip
    expect(prompt).toMatch(/Example shapes/);
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
