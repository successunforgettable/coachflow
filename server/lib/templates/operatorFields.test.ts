import { describe, it, expect } from "vitest";
import type { LandingPageContent } from "../../../drizzle/schema";
import {
  NA_SENTINEL,
  classifyPrice,
  classifyBooking,
  classifyLocation,
  unansweredRequiredOperatorFields,
  OPERATOR_TOKEN_REGISTRY,
  KNOWN_OPERATOR_TOKENS,
  resolveOperatorToken,
  applyOperatorAnswer,
  deriveOperatorQuestions,
  parseEventDateTime,
  expandOperatorAnswer,
  reapplyOperatorAnswer,
  deriveAnsweredOperatorFields,
  normalizeOperatorAnswer,
  canonicalEventDate,
  canonicalEventTime,
} from "./operatorFields";

const price = (amount?: string): LandingPageContent["price"] =>
  amount === undefined ? undefined : ({ amount } as LandingPageContent["price"]);

describe("operatorFields — three-state resolver", () => {
  describe("classifyPrice", () => {
    it("a real amount is a value (event → paid / sales → price)", () => {
      const s = classifyPrice({ amount: "2,000", currency: "$", installments: "3×" } as any);
      expect(s).toEqual({ status: "value", value: { amount: "2,000", currency: "$", installments: "3×" } });
    });
    it("__FREE__ is an explicit N/A answer (free)", () => {
      expect(classifyPrice(price(NA_SENTINEL.FREE))).toEqual({ status: "na", kind: "free" });
    });
    it("__BY_APPLICATION__ is an explicit N/A answer (by_application)", () => {
      expect(classifyPrice(price(NA_SENTINEL.BY_APPLICATION))).toEqual({ status: "na", kind: "by_application" });
    });
    it("null / empty / whitespace is unanswered — NEVER assumed free", () => {
      expect(classifyPrice(undefined).status).toBe("unanswered");
      expect(classifyPrice(null as any).status).toBe("unanswered");
      expect(classifyPrice(price("")).status).toBe("unanswered");
      expect(classifyPrice(price("   ")).status).toBe("unanswered");
    });
    it("unanswered is DISTINCT from free — the silent-paid-ships-free guard", () => {
      expect(classifyPrice(undefined).status).not.toBe(classifyPrice(price(NA_SENTINEL.FREE)).status);
    });
  });

  describe("classifyBooking", () => {
    it("a real URL is a value", () => {
      expect(classifyBooking("https://cal.com/asha")).toEqual({ status: "value", value: "https://cal.com/asha" });
    });
    it("__EMAIL_CAPTURE__ is an explicit N/A answer (email_capture)", () => {
      expect(classifyBooking(NA_SENTINEL.EMAIL_CAPTURE)).toEqual({ status: "na", kind: "email_capture" });
    });
    it("null / empty is unanswered → held", () => {
      expect(classifyBooking(null).status).toBe("unanswered");
      expect(classifyBooking("").status).toBe("unanswered");
    });
  });

  describe("classifyLocation", () => {
    it("a real venue is a value", () => {
      expect(classifyLocation("Las Vegas")).toEqual({ status: "value", value: "Las Vegas" });
    });
    it("__ONLINE__ is an explicit N/A answer (online)", () => {
      expect(classifyLocation(NA_SENTINEL.ONLINE)).toEqual({ status: "na", kind: "online" });
    });
    it("null / empty is unanswered → held (online must be explicit, not inferred)", () => {
      expect(classifyLocation(null).status).toBe("unanswered");
      expect(classifyLocation("").status).toBe("unanswered");
    });
  });

  describe("unansweredRequiredOperatorFields — publish-gate half", () => {
    it("HOLDS an event with unanswered price (never ships free)", () => {
      expect(unansweredRequiredOperatorFields("event_registration", { price: undefined })).toContain(
        "event price (is it free or paid?)",
      );
    });
    it("an explicitly FREE event is complete → not held", () => {
      expect(unansweredRequiredOperatorFields("event_registration", { price: price(NA_SENTINEL.FREE) })).toEqual([]);
    });
    it("a PAID event (real amount) is complete → not held", () => {
      expect(unansweredRequiredOperatorFields("event_registration", { price: price("2,000") })).toEqual([]);
    });
    it("non-event page types are unaffected by the event-price rule", () => {
      expect(unansweredRequiredOperatorFields("sales_page", { price: undefined })).toEqual([]);
      expect(unansweredRequiredOperatorFields("webinar_registration", { price: undefined })).toEqual([]);
    });
  });
});

describe("OPERATOR_TOKEN_REGISTRY — the unified token↔field↔question source", () => {
  it("covers the known operator token set with canonical names (no forbidden aliases)", () => {
    for (const t of ["[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]",
      "[INSERT_EVENT_VENUE]", "[INSERT_BOOKING_URL]", "[INSERT_PRICE]", "[INSERT_REPLAY_AVAILABILITY]",
      "[INSERT_HOST_NAME]"]) {
      expect(KNOWN_OPERATOR_TOKENS).toContain(t);
    }
    // forbidden aliases must NOT be in the registry (the generator maps/rejects them)
    for (const t of ["[INSERT_BOOKING_LINK]", "[INSERT_LAUNCH_DATE]", "[INSERT_DEADLINE]", "[INSERT_DOWNLOAD_LINK]"]) {
      expect(KNOWN_OPERATOR_TOKENS).not.toContain(t);
    }
  });

  it("every entry's token key matches its map key and has a category+scope", () => {
    for (const [k, spec] of Object.entries(OPERATOR_TOKEN_REGISTRY)) {
      expect(spec.token).toBe(k);
      expect(["hard-hold", "nudge", "auto-fill"]).toContain(spec.category);
      expect(["content", "coach", "copy-only"]).toContain(spec.scope);
      if (spec.scope !== "copy-only") expect(spec.path).toBeTruthy();
      if (spec.category !== "auto-fill") expect(spec.question.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveOperatorToken — one answer → two effects", () => {
  it("a value answer writes the structured field AND fills the copy (event date)", () => {
    const r = resolveOperatorToken("[INSERT_EVENT_DATE]", "August 12, 2026");
    expect(r.known).toBe(true);
    expect(r.isNa).toBe(false);
    expect(r.structured).toEqual({ scope: "content", path: "eventSchedule.date", value: "August 12, 2026" });
    expect(r.copy).toEqual({ token: "[INSERT_EVENT_DATE]", text: "August 12, 2026" });
  });

  it("an N/A answer writes the SENTINEL to the field but the human copyText to prose (price → free)", () => {
    const r = resolveOperatorToken("[INSERT_PRICE]", NA_SENTINEL.FREE);
    expect(r.isNa).toBe(true);
    expect(r.structured).toEqual({ scope: "content", path: "price.amount", value: NA_SENTINEL.FREE });
    expect(r.copy.text).toBe("free"); // never the raw __FREE__ sentinel in copy
  });

  it("booking email-capture → coach-scoped sentinel + graceful copy (never the sentinel)", () => {
    const r = resolveOperatorToken("[INSERT_BOOKING_URL]", NA_SENTINEL.EMAIL_CAPTURE);
    expect(r.structured).toEqual({ scope: "coach", path: "bookingUrl", value: NA_SENTINEL.EMAIL_CAPTURE });
    expect(r.copy.text).toBe("using the form on this page");
    expect(r.copy.text).not.toContain("__EMAIL_CAPTURE__");
  });

  it("a copy-only token has NO structured write — just fills the prose (replay)", () => {
    const r = resolveOperatorToken("[INSERT_REPLAY_AVAILABILITY]", "Yes, for 48 hours");
    expect(r.known).toBe(true);
    expect(r.structured).toBeNull();
    expect(r.copy.text).toBe("Yes, for 48 hours");
  });

  it("FAIL-SAFE: an unknown token is known=false, no structured write, copy still filled (never a dead token)", () => {
    const r = resolveOperatorToken("[INSERT_SOMETHING_NEW]", "the answer");
    expect(r.known).toBe(false);
    expect(r.structured).toBeNull();
    expect(r.copy).toEqual({ token: "[INSERT_SOMETHING_NEW]", text: "the answer" });
  });
});

describe("applyOperatorAnswer — the unified action (three-state + PlaceholderEditor, one call)", () => {
  // A content object shaped like LP 214: the token is BAKED into the copy, not in eventSchedule.
  const baked = {
    mainHeadline: "Join my free training",
    subheadline: "Join me live on [INSERT_EVENT_DATE] for a free session.",
    scarcityUrgency: "Runs once on [INSERT_EVENT_DATE].",
    faq: [{ question: "When?", answer: "The training runs live on [INSERT_EVENT_DATE]." }],
  } as unknown as LandingPageContent;

  it("one answer BOTH sets the structured field AND clears every baked copy token", () => {
    const { content, coachColumn } = applyOperatorAnswer(baked, "[INSERT_EVENT_DATE]", "August 12, 2026");
    // structured binding set
    expect((content as any).eventSchedule.date).toBe("August 12, 2026");
    // every baked copy occurrence replaced — no residual token anywhere
    expect(JSON.stringify(content)).not.toContain("[INSERT_EVENT_DATE]");
    expect((content as any).subheadline).toContain("August 12, 2026");
    expect((content as any).faq[0].answer).toContain("August 12, 2026");
    expect(coachColumn).toBeUndefined(); // content-scoped, not coach
    // input not mutated
    expect((baked as any).eventSchedule).toBeUndefined();
    expect((baked as any).subheadline).toContain("[INSERT_EVENT_DATE]");
  });

  it("a coach-scoped answer returns coachColumn + substitutes copy, without touching content fields", () => {
    const c = { subheadline: "Book at [INSERT_BOOKING_URL]." } as unknown as LandingPageContent;
    const { content, coachColumn } = applyOperatorAnswer(c, "[INSERT_BOOKING_URL]", "https://cal.com/asha");
    expect(coachColumn).toEqual({ column: "bookingUrl", value: "https://cal.com/asha" });
    expect((content as any).subheadline).toBe("Book at https://cal.com/asha.");
  });

  it("__ONLINE__ location → eventSchedule.venue sentinel + 'online' in copy", () => {
    const c = { subheadline: "Held at [INSERT_EVENT_VENUE]." } as unknown as LandingPageContent;
    const { content } = applyOperatorAnswer(c, "[INSERT_EVENT_VENUE]", NA_SENTINEL.ONLINE);
    expect((content as any).eventSchedule.venue).toBe(NA_SENTINEL.ONLINE);
    expect((content as any).subheadline).toBe("Held at online.");
    expect(JSON.stringify(content)).not.toContain("[INSERT_EVENT_VENUE]");
  });
});

describe("deriveOperatorQuestions — token-driven, per-page ask list", () => {
  const tokens = (qs: ReturnType<typeof deriveOperatorQuestions>) => qs.map((q) => q.token);

  it("webinar with baked date/time/tz tokens → asks exactly those three, in gating order", () => {
    const content = {
      subheadline: "Join me live on [INSERT_EVENT_DATE] at [INSERT_EVENT_TIME] [INSERT_EVENT_TIMEZONE].",
      faq: [{ answer: "Runs on [INSERT_EVENT_DATE]." }],
    } as unknown as LandingPageContent;
    const qs = deriveOperatorQuestions("webinar_registration", content, {});
    expect(tokens(qs)).toEqual(["[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]"]);
    expect(qs[0].question).toMatch(/date/i);
    expect(qs.every((q) => q.known)).toBe(true);
  });

  it("sales page with no price (template-emitted, NOT baked) → asks price with by-application only (no 'free')", () => {
    const content = { mainHeadline: "Join the Academy" } as unknown as LandingPageContent; // no baked tokens
    const qs = deriveOperatorQuestions("sales_page", content, {});
    expect(tokens(qs)).toEqual(["[INSERT_PRICE]"]);
    expect(qs[0].naBranches.map((b) => b.sentinel)).toEqual([NA_SENTINEL.BY_APPLICATION]); // a sales page isn't "free"
  });

  it("a real price already set → price NOT asked (answered = value)", () => {
    const content = { price: { amount: "997" } } as unknown as LandingPageContent;
    expect(deriveOperatorQuestions("sales_page", content, {})).toEqual([]);
  });

  it("an explicit __FREE__ price counts as answered → not asked again", () => {
    const content = { price: { amount: NA_SENTINEL.FREE } } as unknown as LandingPageContent;
    expect(deriveOperatorQuestions("event_registration", content, {})).toContainEqual(
      expect.objectContaining({ token: "[INSERT_EVENT_DATE]" }),
    );
    expect(deriveOperatorQuestions("event_registration", content, {}).map((q) => q.token)).not.toContain("[INSERT_PRICE]");
  });

  it("discovery booking: unanswered coach URL → asks with email-capture branch; set URL → not asked", () => {
    const content = {} as unknown as LandingPageContent;
    const asked = deriveOperatorQuestions("discovery_call_booking", content, { bookingUrl: null });
    expect(tokens(asked)).toEqual(["[INSERT_BOOKING_URL]"]);
    expect(asked[0].naBranches[0].sentinel).toBe(NA_SENTINEL.EMAIL_CAPTURE);
    expect(deriveOperatorQuestions("discovery_call_booking", content, { bookingUrl: "https://cal.com/x" })).toEqual([]);
  });

  it("auto-fill tokens (host name) are NEVER asked; a stray unknown token surfaces via the fail-safe", () => {
    const content = {
      subheadline: "Hosted by [INSERT_HOST_NAME].",           // auto-fill → excluded
      faq: [{ answer: "See [INSERT_MYSTERY_FIELD] for details." }], // unknown → generic prompt
    } as unknown as LandingPageContent;
    const qs = deriveOperatorQuestions("webinar_registration", content, {});
    expect(tokens(qs)).not.toContain("[INSERT_HOST_NAME]");
    const mystery = qs.find((q) => q.token === "[INSERT_MYSTERY_FIELD]");
    expect(mystery).toBeDefined();
    expect(mystery!.known).toBe(false);
  });

  it("lead-magnet page needs no operator answers", () => {
    expect(deriveOperatorQuestions("lead_magnet_download", { mainHeadline: "Get the guide" } as any, {})).toEqual([]);
  });

  it("PRICE branches are pageType-aware: event → free only; sales → by-application only", () => {
    const evPrice = deriveOperatorQuestions("event_registration", { eventSchedule: { date: "x", venue: "y" } } as any, {}).find((q) => q.token === "[INSERT_PRICE]");
    expect(evPrice!.naBranches.map((b) => b.sentinel)).toEqual([NA_SENTINEL.FREE]); // no "By application" on an event
    const salesPrice = deriveOperatorQuestions("sales_page", {} as any, {}).find((q) => q.token === "[INSERT_PRICE]");
    expect(salesPrice!.naBranches.map((b) => b.sentinel)).toEqual([NA_SENTINEL.BY_APPLICATION]); // no "It's free" on a sales page
  });
});

describe("parseEventDateTime + expandOperatorAnswer — front-loading a full datetime", () => {
  it("splits 'August 12 at 11am GMT' into date / time / timezone", () => {
    expect(parseEventDateTime("August 12 at 11am GMT")).toEqual({ date: "August 12", time: "11 am", timezone: "GMT" });
  });
  it("24h time + offset timezone", () => {
    const p = parseEventDateTime("Tuesday 12 Aug, 14:00 UTC+1");
    expect(p.time).toBe("14:00");
    expect(p.timezone).toBe("UTC+1");
    expect(p.date).toContain("Aug");
  });
  it("a bare date leaves time/timezone undefined (no fabrication)", () => {
    expect(parseEventDateTime("August 12")).toEqual({ date: "August 12", time: undefined, timezone: undefined });
  });
  it("expandOperatorAnswer front-loads the date answer into 3 writes; other tokens stay single", () => {
    expect(expandOperatorAnswer("[INSERT_EVENT_DATE]", "Aug 12 at 11am GMT")).toEqual([
      { token: "[INSERT_EVENT_DATE]", value: "Aug 12" },
      { token: "[INSERT_EVENT_TIME]", value: "11 am" },
      { token: "[INSERT_EVENT_TIMEZONE]", value: "GMT" },
    ]);
    expect(expandOperatorAnswer("[INSERT_EVENT_DATE]", "August 12")).toEqual([{ token: "[INSERT_EVENT_DATE]", value: "August 12" }]);
    expect(expandOperatorAnswer("[INSERT_PRICE]", NA_SENTINEL.FREE)).toEqual([{ token: "[INSERT_PRICE]", value: NA_SENTINEL.FREE }]);
    expect(expandOperatorAnswer("[INSERT_EVENT_TIME]", "11 am")).toEqual([{ token: "[INSERT_EVENT_TIME]", value: "11 am" }]);
  });
});

describe("edit flow — reapplyOperatorAnswer + deriveAnsweredOperatorFields", () => {
  it("changing an answered venue replaces the OLD value in ALL copy + re-sets the field (old gone)", () => {
    // simulate a page where the FIRST answer already substituted the token → literal "Dubai" in the copy
    let content = {
      eyebrowHeadline: "LIVE EVENT AT [INSERT_EVENT_VENUE]",
      subheadline: "One day at [INSERT_EVENT_VENUE].",
    } as unknown as LandingPageContent;
    content = applyOperatorAnswer(content, "[INSERT_EVENT_VENUE]", "Dubai").content;
    expect(JSON.stringify(content)).toContain("Dubai");
    expect(JSON.stringify(content)).not.toContain("[INSERT_EVENT_VENUE]");
    // now the coach edits the venue → Abu Dhabi
    const edited = reapplyOperatorAnswer(content, "[INSERT_EVENT_VENUE]", "Dubai", "Abu Dhabi");
    expect((edited.content as any).eventSchedule.venue).toBe("Abu Dhabi");
    expect(JSON.stringify(edited.content)).toContain("Abu Dhabi");
    expect(JSON.stringify(edited.content)).not.toContain("Dubai"); // old value gone everywhere
  });

  it("discovery booking URL → __EMAIL_CAPTURE__ re-answer flips the coach column + copy", () => {
    const content = { subheadline: "Book at https://cal.com/asha." } as unknown as LandingPageContent;
    // first answer set a real URL; now re-answer as email-capture
    const edited = reapplyOperatorAnswer(content, "[INSERT_BOOKING_URL]", "https://cal.com/asha", NA_SENTINEL.EMAIL_CAPTURE);
    expect(edited.coachColumn).toEqual({ column: "bookingUrl", value: NA_SENTINEL.EMAIL_CAPTURE });
    expect((edited.content as any).subheadline).toContain("using the form on this page");
    expect(JSON.stringify(edited.content)).not.toContain("cal.com/asha"); // old URL gone from copy
  });

  it("a first answer (no prior value) behaves exactly like applyOperatorAnswer", () => {
    const content = { subheadline: "Live on [INSERT_EVENT_DATE]." } as unknown as LandingPageContent;
    const edited = reapplyOperatorAnswer(content, "[INSERT_EVENT_DATE]", "", "August 12");
    expect((edited.content as any).eventSchedule.date).toBe("August 12");
    expect((edited.content as any).subheadline).toBe("Live on August 12.");
  });

  it("deriveAnsweredOperatorFields lists answered fields with friendly current values + branches", () => {
    const content = { eventSchedule: { date: "Aug 12", venue: NA_SENTINEL.ONLINE }, price: { amount: "500" } } as unknown as LandingPageContent;
    const fields = deriveAnsweredOperatorFields("event_registration", content, {});
    const byKey = Object.fromEntries(fields.map((f) => [f.token, f]));
    expect(byKey["[INSERT_EVENT_DATE]"].current).toBe("Aug 12");
    expect(byKey["[INSERT_EVENT_VENUE]"].current).toBe("It's online"); // sentinel → friendly label
    expect(byKey["[INSERT_PRICE]"].current).toBe("500");
    expect(byKey["[INSERT_PRICE]"].naBranches.map((b) => b.sentinel)).toEqual([NA_SENTINEL.FREE]); // event → free only
    // an UNANSWERED field is not listed as editable
    const noVenue = deriveAnsweredOperatorFields("event_registration", { eventSchedule: { date: "Aug 12" } } as any, {});
    expect(noVenue.find((f) => f.token === "[INSERT_EVENT_VENUE]")).toBeUndefined();
  });
});

// ── Batch A / item 3 + item 2 (2026-07-22): structured inputs + sentinel normalize ──

describe("canonicalEventDate — a native date-picker value → a human, Date.parse-able string", () => {
  it("ISO → 'Month D, YYYY'", () => {
    expect(canonicalEventDate("2026-08-28")).toBe("August 28, 2026");
    expect(canonicalEventDate("2026-01-05")).toBe("January 5, 2026");
    expect(canonicalEventDate("2026-12-31")).toBe("December 31, 2026");
  });
  it("the result is always Date.parse-able (the WhatsApp/email length-derivation fix)", () => {
    expect(Number.isNaN(Date.parse(canonicalEventDate("2026-08-28")))).toBe(false);
    // the OLD broken shape (an ordinal a coach could type) is exactly what the picker now makes impossible:
    expect(Number.isNaN(Date.parse("28th august 2026"))).toBe(true);
  });
  it("a non-ISO value (a typed date the front-load parser handled) passes through untouched", () => {
    expect(canonicalEventDate("August 12")).toBe("August 12");
    expect(canonicalEventDate("next Tuesday")).toBe("next Tuesday");
  });
  it("an out-of-range ISO passes through rather than fabricating a month", () => {
    expect(canonicalEventDate("2026-13-40")).toBe("2026-13-40");
  });
});

describe("canonicalEventTime — a native time-picker value → a human 12-hour string", () => {
  it("24h HH:MM → h:mm am/pm, with the noon/midnight edges", () => {
    expect(canonicalEventTime("14:30")).toBe("2:30 pm");
    expect(canonicalEventTime("09:05")).toBe("9:05 am");
    expect(canonicalEventTime("00:00")).toBe("12:00 am");
    expect(canonicalEventTime("12:00")).toBe("12:00 pm");
  });
  it("a non-HH:MM value passes through", () => {
    expect(canonicalEventTime("11am")).toBe("11am");
  });
});

describe("normalizeOperatorAnswer — the item-2 safety net (typed N/A → sentinel + picker canonicalize)", () => {
  it("PRICE: a typed free/zero phrase → __FREE__", () => {
    for (const t of ["free", "Free", "FREE", "no charge", "no cost", "£0", "$0", "0", "£0.00"]) {
      expect(normalizeOperatorAnswer("[INSERT_PRICE]", t)).toBe(NA_SENTINEL.FREE);
    }
  });
  it("PRICE: a typed by-application phrase → __BY_APPLICATION__", () => {
    for (const t of ["by application", "By application", "on application", "apply", "POA", "price on application"]) {
      expect(normalizeOperatorAnswer("[INSERT_PRICE]", t)).toBe(NA_SENTINEL.BY_APPLICATION);
    }
  });
  it("PRICE: a real number passes through", () => {
    expect(normalizeOperatorAnswer("[INSERT_PRICE]", "497")).toBe("497");
    expect(normalizeOperatorAnswer("[INSERT_PRICE]", "1,500")).toBe("1,500");
  });
  it("VENUE: a typed online phrase → __ONLINE__; a real place passes through", () => {
    for (const t of ["online", "Online", "virtual", "remote", "Zoom"]) {
      expect(normalizeOperatorAnswer("[INSERT_EVENT_VENUE]", t)).toBe(NA_SENTINEL.ONLINE);
    }
    expect(normalizeOperatorAnswer("[INSERT_EVENT_VENUE]", "IN5 Dubai")).toBe("IN5 Dubai");
  });
  it("DATE/TIME: canonicalizes a picker's raw value", () => {
    expect(normalizeOperatorAnswer("[INSERT_EVENT_DATE]", "2026-08-28")).toBe("August 28, 2026");
    expect(normalizeOperatorAnswer("[INSERT_EVENT_TIME]", "14:30")).toBe("2:30 pm");
  });
  it("is token-scoped: 'online' is only an N/A on the venue token, not elsewhere", () => {
    expect(normalizeOperatorAnswer("[INSERT_EVENT_DATE]", "online")).toBe("online");
    expect(normalizeOperatorAnswer("[INSERT_BOOKING_URL]", "free")).toBe("free");
  });
  it("passes sentinels, skips, and empties through untouched, and is idempotent", () => {
    expect(normalizeOperatorAnswer("[INSERT_PRICE]", NA_SENTINEL.FREE)).toBe(NA_SENTINEL.FREE);
    expect(normalizeOperatorAnswer("[INSERT_EVENT_VENUE]", "__SKIP__")).toBe("__SKIP__");
    expect(normalizeOperatorAnswer("[INSERT_PRICE]", "")).toBe("");
    const once = normalizeOperatorAnswer("[INSERT_EVENT_DATE]", "2026-08-28");
    expect(normalizeOperatorAnswer("[INSERT_EVENT_DATE]", once)).toBe(once); // idempotent
  });
});

describe("applyOperatorAnswer — normalize runs at the single chokepoint (item 2 wiring)", () => {
  it("a typed 'free' price resolves as the __FREE__ N/A (structured sentinel + 'free' in the copy)", () => {
    const content = { subheadline: "Tickets are [INSERT_PRICE]." } as unknown as LandingPageContent;
    const applied = applyOperatorAnswer(content, "[INSERT_PRICE]", "free");
    expect((applied.content as any).price.amount).toBe(NA_SENTINEL.FREE);
    expect((applied.content as any).subheadline).toBe("Tickets are free.");
    expect(applied.resolution.isNa).toBe(true);
  });
  it("an ISO date from the picker is stored human + Date.parse-able (routing/length fix, end to end)", () => {
    const content = { subheadline: "Live on [INSERT_EVENT_DATE]." } as unknown as LandingPageContent;
    const applied = applyOperatorAnswer(content, "[INSERT_EVENT_DATE]", "2026-08-28");
    expect((applied.content as any).eventSchedule.date).toBe("August 28, 2026");
    expect((applied.content as any).subheadline).toBe("Live on August 28, 2026.");
    expect(Number.isNaN(Date.parse((applied.content as any).eventSchedule.date))).toBe(false);
  });
  it("a typed 'online' venue resolves as __ONLINE__", () => {
    const content = { subheadline: "Join us [INSERT_EVENT_VENUE]." } as unknown as LandingPageContent;
    const applied = applyOperatorAnswer(content, "[INSERT_EVENT_VENUE]", "virtual");
    expect((applied.content as any).eventSchedule.venue).toBe(NA_SENTINEL.ONLINE);
    expect((applied.content as any).subheadline).toBe("Join us online.");
  });
});

describe("inputType — the registry + question list drive the structured control (item 3)", () => {
  it("the registry carries the structured control per token", () => {
    expect(OPERATOR_TOKEN_REGISTRY["[INSERT_EVENT_DATE]"].inputType).toBe("date");
    expect(OPERATOR_TOKEN_REGISTRY["[INSERT_EVENT_TIME]"].inputType).toBe("time");
    expect(OPERATOR_TOKEN_REGISTRY["[INSERT_EVENT_VENUE]"].inputType).toBe("venue");
    expect(OPERATOR_TOKEN_REGISTRY["[INSERT_PRICE]"].inputType).toBe("price");
    expect(OPERATOR_TOKEN_REGISTRY["[INSERT_BOOKING_URL]"].inputType).toBeUndefined(); // → "text" default
  });
  it("[INSERT_COACH_CREDENTIAL] is registered with a real question (Batch A one-line add)", () => {
    const spec = OPERATOR_TOKEN_REGISTRY["[INSERT_COACH_CREDENTIAL]"];
    expect(spec).toBeDefined();
    expect(spec.question.length).toBeGreaterThan(0);
    expect(KNOWN_OPERATOR_TOKENS).toContain("[INSERT_COACH_CREDENTIAL]");
  });
  it("deriveOperatorQuestions surfaces inputType (default 'text' where unset)", () => {
    const qs = deriveOperatorQuestions("event_registration", { eventSchedule: {} } as any, {});
    const byToken = Object.fromEntries(qs.map((q) => [q.token, q]));
    expect(byToken["[INSERT_EVENT_DATE]"].inputType).toBe("date");
    expect(byToken["[INSERT_EVENT_VENUE]"].inputType).toBe("venue");
    expect(byToken["[INSERT_PRICE]"].inputType).toBe("price");
  });
  it("deriveAnsweredOperatorFields carries inputType for the matching edit control", () => {
    const content = { eventSchedule: { date: "Aug 12" }, price: { amount: "500" } } as unknown as LandingPageContent;
    const byToken = Object.fromEntries(deriveAnsweredOperatorFields("event_registration", content, {}).map((f) => [f.token, f]));
    expect(byToken["[INSERT_EVENT_DATE]"].inputType).toBe("date");
    expect(byToken["[INSERT_PRICE]"].inputType).toBe("price");
  });
});
