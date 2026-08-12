/**
 * step4cPageAnswers.test.ts — the canned answers that let the 4c throwaway page clear its own
 * publish gate, and the assertion that proves it did.
 *
 * Every case here pins something the 2026-08-10 failure taught. The run died on ONE token
 * ([INSERT_PRICE]) after twelve minutes of generation and before a single Graph call, so these
 * are not style tests: each one is a way the re-run could die in the same place again.
 *
 * The real `applyOperatorAnswer` is exercised alongside, because the harness's claim is not
 * "our table has a price in it" — it is "answering through the coach's own path clears the
 * token the gate scans for".
 */

import { describe, it, expect } from "vitest";
import {
  ANGLE_COLS, CANNED_OPERATOR_ANSWERS, GENERIC_FALLBACK_ANSWER, OPERATOR_TOKEN_RE,
  activeAngleColumn, assertActiveAngleHasNoOperatorTokens, assertNoOperatorTokens,
  assertNoSentinelAnswers, cannedAnswerFor, collectTokens, dbColumnNameFor, planOperatorAnswers,
  snapshotCoachColumn,
} from "./step4cPageAnswers";
import { applyOperatorAnswer, deriveOperatorQuestions } from "../lib/templates/operatorFields";
import { NA_SENTINEL } from "../lib/templates/operatorFields";

describe("the table never answers with an N/A sentinel", () => {
  it("prices the page with a real amount, not __FREE__", () => {
    const price = CANNED_OPERATOR_ANSWERS["[INSERT_PRICE]"];
    expect(price).toBeTruthy();
    expect(price).not.toBe(NA_SENTINEL.FREE);
    expect(price).not.toBe(NA_SENTINEL.BY_APPLICATION);
    expect(price).toMatch(/\d/);
  });

  it("holds no sentinel anywhere in the table", () => {
    const plan = Object.keys(CANNED_OPERATOR_ANSWERS).map(cannedAnswerFor);
    expect(() => assertNoSentinelAnswers(plan)).not.toThrow();
  });

  it("REFUSES a plan that would answer with a sentinel", () => {
    expect(() => assertNoSentinelAnswers([{ token: "[INSERT_PRICE]", answer: "__FREE__", source: "canned" }]))
      .toThrow(/sentinel/i);
  });

  it("REFUSES an empty answer — the token would vanish and leave a gap", () => {
    expect(() => assertNoSentinelAnswers([{ token: "[INSERT_PRICE]", answer: "   ", source: "canned" }]))
      .toThrow(/empty/i);
  });

  it("no canned answer smuggles in another token", () => {
    for (const [token, answer] of Object.entries(CANNED_OPERATOR_ANSWERS)) {
      expect(answer.match(OPERATOR_TOKEN_RE), `${token} answers with a token`).toBeNull();
    }
    expect(GENERIC_FALLBACK_ANSWER.match(OPERATOR_TOKEN_RE)).toBeNull();
  });
});

describe("an unknown token still gets an answer", () => {
  it("falls back to a hedge rather than inventing a specific", () => {
    const a = cannedAnswerFor("[INSERT_SOMETHING_NOBODY_REGISTERED]");
    expect(a.source).toBe("fallback");
    expect(a.answer).toBe(GENERIC_FALLBACK_ANSWER);
  });

  it("a known token is a table hit", () => {
    expect(cannedAnswerFor("[INSERT_PRICE]").source).toBe("canned");
  });
});

describe("collectTokens finds tokens wherever the generator buried them", () => {
  it("walks nested objects and arrays and de-duplicates", () => {
    const content = {
      mainHeadline: "Join for [INSERT_PRICE]",
      bullets: ["pay [INSERT_PRICE] once", { note: "hosted by [INSERT_HOST_NAME]" }],
      count: 3,
      nothing: null,
    };
    expect(collectTokens(content)).toEqual(["[INSERT_PRICE]", "[INSERT_HOST_NAME]"]);
  });

  it("returns nothing for clean content", () => {
    expect(collectTokens({ a: "all filled in", b: [1, 2, null] })).toEqual([]);
  });
});

describe("planOperatorAnswers unions the two sources — neither subsumes the other", () => {
  it("covers a baked token that is never asked and an asked token that is never baked", () => {
    // [INSERT_HOST_NAME] is auto-fill: baked in prose, deliberately excluded from questions.
    // [INSERT_PRICE] here is the structural hold: asked for, with no token in the prose.
    const plan = planOperatorAnswers(["[INSERT_HOST_NAME]"], ["[INSERT_PRICE]"]);
    expect(plan.map((p) => p.token)).toEqual(["[INSERT_HOST_NAME]", "[INSERT_PRICE]"]);
  });

  it("answers a token appearing in both exactly once", () => {
    const plan = planOperatorAnswers(["[INSERT_PRICE]"], ["[INSERT_PRICE]"]);
    expect(plan).toHaveLength(1);
  });

  it("ignores empty entries", () => {
    expect(planOperatorAnswers(["", "[INSERT_PRICE]"], [])).toHaveLength(1);
  });
});

describe("assertNoOperatorTokens — the proof the page will clear the gate", () => {
  it("passes clean html", () => {
    expect(() => assertNoOperatorTokens("<h1>Join for AED 4,500</h1>", "the page")).not.toThrow();
  });

  it("names every surviving token, de-duplicated, and says where", () => {
    const html = "<h1>[INSERT_PRICE]</h1><p>[INSERT_PRICE] and [INSERT_EVENT_VENUE]</p>";
    try {
      assertNoOperatorTokens(html, "the rendered landing page");
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("[INSERT_PRICE]");
      expect(e.message).toContain("[INSERT_EVENT_VENUE]");
      expect(e.message).toContain("the rendered landing page");
      expect(e.message).toContain("2 unfilled");
    }
  });

  it("uses the SAME token shape the publish gate scans for", () => {
    // landingPagePublisher.ts scans /\[INSERT_[A-Z_0-9]+\]/g. A narrower regex here would let a
    // page through this check and then fail at the gate — the exact 08-10 shape.
    const gateRe = /\[INSERT_[A-Z_0-9]+\]/g;
    const sample = "[INSERT_PRICE] [INSERT_EVENT_DATE] [INSERT_COHORT_LIMIT_2]";
    expect(sample.match(gateRe)).toEqual(sample.match(OPERATOR_TOKEN_RE));
  });
});

describe("end to end against the REAL operator path — the token is actually cleared", () => {
  const pageWithPrice = {
    mainHeadline: "The Scope-First Sequence",
    subheadline: "Enrol today for [INSERT_PRICE].",
    price: { amount: "" },
  } as any;

  it("answering [INSERT_PRICE] clears the prose AND sets price.amount", () => {
    const answer = CANNED_OPERATOR_ANSWERS["[INSERT_PRICE]"];
    const applied = applyOperatorAnswer(pageWithPrice, "[INSERT_PRICE]", answer);
    expect(applied.content.subheadline).toBe(`Enrol today for ${answer}.`);
    expect((applied.content as any).price.amount).toBe(answer);
    expect(() => assertNoOperatorTokens(JSON.stringify(applied.content), "content")).not.toThrow();
  });

  it("a sales page that asked for a price stops asking once answered", () => {
    const before = deriveOperatorQuestions("sales_page", pageWithPrice, { bookingUrl: "https://example.com/book" });
    expect(before.map((q) => q.token)).toContain("[INSERT_PRICE]");

    const applied = applyOperatorAnswer(pageWithPrice, "[INSERT_PRICE]", CANNED_OPERATOR_ANSWERS["[INSERT_PRICE]"]);
    const after = deriveOperatorQuestions("sales_page", applied.content, { bookingUrl: "https://example.com/book" });
    expect(after.map((q) => q.token)).not.toContain("[INSERT_PRICE]");
  });

  it("answering every question the page asks leaves the content token-free", () => {
    const messy = {
      mainHeadline: "Live with [INSERT_HOST_NAME]",
      subheadline: "On [INSERT_EVENT_DATE] at [INSERT_EVENT_TIME] [INSERT_EVENT_TIMEZONE]",
      body: "Seats are [INSERT_PRICE]. Venue: [INSERT_EVENT_VENUE]. [INSERT_WILDLY_UNKNOWN_THING]",
      price: { amount: "" },
    } as any;
    const plan = planOperatorAnswers(
      collectTokens(messy),
      deriveOperatorQuestions("event_registration", messy, { bookingUrl: null }).map((q) => q.token),
    );
    assertNoSentinelAnswers(plan);
    let content = messy;
    for (const step of plan) content = applyOperatorAnswer(content, step.token, step.answer).content;
    expect(() => assertNoOperatorTokens(JSON.stringify(content), "content")).not.toThrow();
    // and the unknown one was hedged, not invented
    expect(JSON.stringify(content)).toContain(GENERIC_FALLBACK_ANSWER);
  });

  it("the price answer never routes the page to the FREE template", () => {
    const applied = applyOperatorAnswer(pageWithPrice, "[INSERT_PRICE]", CANNED_OPERATOR_ANSWERS["[INSERT_PRICE]"]);
    expect((applied.content as any).price.amount).not.toBe(NA_SENTINEL.FREE);
    expect(applied.resolution.isNa).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FIX 1 — the stored-content assertion is scoped to the ACTIVE angle
//
// The 2026-08-12 prepare run died on [INSERT_CART_CLOSE] living only in dollarAngle while
// `original` was active. The page it was about to publish was already clean. These cases pin the
// scope in BOTH directions: a non-active angle must not fail the run, and the active angle must
// still fail it. A test that only proved the first half would pass against a deleted assertion.
// ══════════════════════════════════════════════════════════════════════════════

const cleanAngle = { headline: "Scope first, then price", faq: [{ answer: "No tokens here" }] };
const tokenAngle = { headline: "Close the cart [INSERT_CART_CLOSE]", faq: [] };

describe("the stored-content assertion covers the ACTIVE angle only", () => {
  it("a token in a NON-ACTIVE angle does not fail the run — that angle never renders", () => {
    const row = {
      originalAngle: cleanAngle, godfatherAngle: cleanAngle,
      freeAngle: cleanAngle, dollarAngle: tokenAngle,
    };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "original")).not.toThrow();
  });

  it("the exact 2026-08-12 shape no longer fails prepare", () => {
    const row = { originalAngle: cleanAngle, dollarAngle: { cta: "[INSERT_CART_CLOSE]" } };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "original")).not.toThrow();
  });

  it("a token in the ACTIVE angle STILL fails, and names the token", () => {
    const row = { originalAngle: tokenAngle, dollarAngle: cleanAngle };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "original"))
      .toThrow(/\[INSERT_CART_CLOSE\]/);
  });

  it("scope follows activeAngle rather than always meaning `original`", () => {
    // Inverted on purpose: the token now sits in `original` while `dollar` is active. If the
    // assertion silently always read originalAngle, this would throw and the scoping would be a
    // coincidence rather than a rule.
    const row = { originalAngle: tokenAngle, dollarAngle: cleanAngle };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "dollar")).not.toThrow();
  });

  it("an active angle carrying a token fails whichever angle is active", () => {
    const row = { originalAngle: cleanAngle, dollarAngle: tokenAngle };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "dollar")).toThrow(/INSERT_CART_CLOSE/);
  });

  it("a null activeAngle falls back to original, and still catches a token there", () => {
    expect(() => assertActiveAngleHasNoOperatorTokens({ originalAngle: tokenAngle }, null))
      .toThrow(/INSERT_CART_CLOSE/);
    expect(() => assertActiveAngleHasNoOperatorTokens({ originalAngle: cleanAngle }, undefined))
      .not.toThrow();
  });

  it("an absent active column falls back to original rather than passing vacuously", () => {
    const row = { originalAngle: tokenAngle };
    expect(() => assertActiveAngleHasNoOperatorTokens(row, "godfather")).toThrow(/INSERT_CART_CLOSE/);
  });

  it("a page with no content at all does not throw", () => {
    expect(() => assertActiveAngleHasNoOperatorTokens({}, "original")).not.toThrow();
  });

  it("activeAngleColumn maps the enum to the stored column, and rejects nonsense", () => {
    expect(activeAngleColumn("original")).toBe("originalAngle");
    expect(activeAngleColumn("dollar")).toBe("dollarAngle");
    expect(activeAngleColumn(null)).toBe("originalAngle");
    expect(activeAngleColumn("not-an-angle")).toBe("originalAngle");
    expect(ANGLE_COLS).toHaveLength(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FIX 2 — the coach-scoped snapshot read must use the DATABASE column name
//
// `users.bookingUrl` is stored as `booking_url`. The snapshot read is raw SQL, so handing it the
// Drizzle key produced `ERROR 1054 Unknown column 'bookingUrl'` and hard-crashed prepare on any
// page needing a booking-URL token. The write and the teardown restore go through Drizzle and
// always used the key correctly — so the fix is at the raw-SQL boundary only.
// ══════════════════════════════════════════════════════════════════════════════

/** Shaped like a Drizzle table: JS key → column object carrying the real DB name. */
const fakeUsers = {
  id: { name: "id" },
  bookingUrl: { name: "booking_url" },
  coachName: { name: "coach_name" },
  noName: {},
};

describe("coach-scoped columns resolve to their real database name", () => {
  it("maps the registry path bookingUrl to booking_url", () => {
    expect(dbColumnNameFor(fakeUsers, "bookingUrl")).toBe("booking_url");
  });

  it("throws a named error for a path the schema does not carry", () => {
    expect(() => dbColumnNameFor(fakeUsers, "notAColumn")).toThrow(/notAColumn/);
  });

  it("throws rather than guessing when a column exposes no database name", () => {
    expect(() => dbColumnNameFor(fakeUsers, "noName")).toThrow(/no database name/);
  });

  it("SNAPSHOT READ EXECUTES and is handed the SNAKE_CASE name, not the JS key", async () => {
    const seen: string[] = [];
    const snap = await snapshotCoachColumn(fakeUsers, "bookingUrl", async (dbColumn) => {
      seen.push(dbColumn);
      return "https://cal.example/prior";
    });
    // The whole bug in one assertion: pre-fix this received "bookingUrl" and MySQL threw 1054.
    expect(seen).toEqual(["booking_url"]);
    expect(snap.dbColumn).toBe("booking_url");
    expect(snap.prior).toBe("https://cal.example/prior");
  });

  it("round-trips the value under the JS KEY, because teardown restores through Drizzle", async () => {
    const snap = await snapshotCoachColumn(fakeUsers, "bookingUrl", async () => "https://cal.example/prior");
    const coachFieldsBefore: Record<string, string | null> = { [snap.key]: snap.prior };
    // Teardown does `db.update(users).set({ [column]: before })` — Drizzle wants the JS key.
    expect(Object.keys(coachFieldsBefore)).toEqual(["bookingUrl"]);
    expect(coachFieldsBefore.bookingUrl).toBe("https://cal.example/prior");
  });

  it("A NULL PRIOR ROUND-TRIPS AS NULL — restoring to empty is the common first run", async () => {
    const snap = await snapshotCoachColumn(fakeUsers, "bookingUrl", async () => null);
    expect(snap.prior).toBeNull();
    const restore: Record<string, string | null> = { [snap.key]: snap.prior };
    expect(restore.bookingUrl).toBeNull();
    expect("bookingUrl" in restore).toBe(true); // present-and-null, not absent
  });

  it("an undefined read is normalised to null so teardown restores explicitly", async () => {
    const snap = await snapshotCoachColumn(fakeUsers, "bookingUrl", async () => undefined);
    expect(snap.prior).toBeNull();
  });

  it("read, write and restore all agree: raw SQL gets booking_url, Drizzle gets bookingUrl", async () => {
    const sqlSaw: string[] = [];
    const snap = await snapshotCoachColumn(fakeUsers, "bookingUrl", async (c) => { sqlSaw.push(c); return null; });
    expect(sqlSaw[0]).toBe("booking_url");        // the READ, raw SQL
    expect(snap.key).toBe("bookingUrl");           // the WRITE, Drizzle .set()
    expect(snap.key).toBe("bookingUrl");           // the RESTORE, Drizzle .set()
    expect(snap.dbColumn).not.toBe(snap.key);      // the two representations are genuinely different
  });
});
