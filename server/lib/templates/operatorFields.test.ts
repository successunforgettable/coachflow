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
