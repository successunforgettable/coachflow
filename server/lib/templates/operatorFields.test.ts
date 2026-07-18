import { describe, it, expect } from "vitest";
import type { LandingPageContent } from "../../../drizzle/schema";
import {
  NA_SENTINEL,
  classifyPrice,
  classifyBooking,
  classifyLocation,
  unansweredRequiredOperatorFields,
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
