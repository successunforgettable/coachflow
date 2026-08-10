/**
 * publishLedger.test.ts — the delete list must exist on disk before it is needed.
 *
 * ⚠️ WHAT THIS PROTECTS. If the process dies between creating a campaign on a real ad account
 * and finishing the run, the only way to find that campaign again is the id. The account has
 * ~200 campaigns and five already share one name, so a name search is neither complete nor
 * unambiguous. The write must therefore happen AT the moment the id comes back — not batched,
 * not at the end, not in memory. That ordering is what these tests pin.
 */

import { describe, it, expect } from "vitest";
import { createPublishLedger, readLedgerLines } from "./publishLedger";

function fake() {
  const lines: string[] = [];
  let n = 0;
  const ledger = createPublishLedger({
    path: "/tmp/test-ledger.jsonl",
    write: (line) => { lines.push(line); },
    now: () => `2026-08-10T00:00:${String(n++).padStart(2, "0")}.000Z`,
  });
  return { ledger, lines };
}

describe("it writes the instant the id exists", () => {
  it("writes one line per object, synchronously, in order", () => {
    const { ledger, lines } = fake();
    ledger.record("campaign", "c1");
    expect(lines).toHaveLength(1); // already on disk before anything else happens
    ledger.record("adset", "s1");
    ledger.record("creative", "cr1");
    ledger.record("ad", "a1");
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l.endsWith("\n"))).toBe(true);
    expect(JSON.parse(lines[0])).toMatchObject({ kind: "campaign", id: "c1" });
  });

  it("returns the id so the call site can use it inline and cannot forget to record it", () => {
    const { ledger, lines } = fake();
    const id = ledger.record("campaign", "c1");
    expect(id).toBe("c1");
    expect(lines).toHaveLength(1);
  });

  it("REFUSES an empty id — a blank entry looks recorded and deletes nothing", () => {
    const { ledger, lines } = fake();
    expect(() => ledger.record("campaign", "")).toThrow(/empty campaign id/);
    expect(() => ledger.record("ad", "   ")).toThrow();
    expect(lines).toHaveLength(0);
  });

  it("trims a padded id so it matches what the guard will compare", () => {
    const { ledger } = fake();
    expect(ledger.record("campaign", "  c1  ")).toBe("c1");
  });
});

describe("what teardown reads back out", () => {
  it("exposes the campaign, ad set, ads and creatives it recorded", () => {
    const { ledger } = fake();
    ledger.record("campaign", "c1");
    ledger.record("adset", "s1");
    ledger.record("creative", "cr1");
    ledger.record("ad", "a1");
    ledger.record("creative", "cr2");
    ledger.record("ad", "a2");
    expect(ledger.campaignId()).toBe("c1");
    expect(ledger.adSetId()).toBe("s1");
    expect(ledger.adIds()).toEqual(["a1", "a2"]);
    expect(ledger.creativeIds()).toEqual(["cr1", "cr2"]);
  });

  it("reports no campaign when none was created — teardown must then refuse", () => {
    const { ledger } = fake();
    expect(ledger.campaignId()).toBeNull();
    expect(ledger.adIds()).toEqual([]);
  });

  it("keeps the FIRST campaign id, so a stray later entry cannot redirect a delete", () => {
    const { ledger } = fake();
    ledger.record("campaign", "c1");
    ledger.record("campaign", "c2");
    expect(ledger.campaignId()).toBe("c1");
  });
});

describe("recovery after an interrupted run", () => {
  it("rebuilds the delete list from the file's lines", () => {
    const { ledger, lines } = fake();
    ledger.record("campaign", "c1");
    ledger.record("ad", "a1");
    const rebuilt = readLedgerLines(lines);
    expect(rebuilt.map((e) => e.id)).toEqual(["c1", "a1"]);
  });

  it("keeps the good entries when a line is corrupt — a partial list beats none", () => {
    const rebuilt = readLedgerLines([
      '{"kind":"campaign","id":"c1","at":"x"}',
      "{ this is not json",
      "",
      '{"kind":"ad","id":"a1","at":"x"}',
    ]);
    expect(rebuilt.map((e) => e.id)).toEqual(["c1", "a1"]);
  });

  it("ignores a well-formed line that carries no usable id", () => {
    expect(readLedgerLines(['{"kind":"campaign"}', '{"id":"a1"}'])).toEqual([]);
  });
});
