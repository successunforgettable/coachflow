import { describe, it, expect } from "vitest";
import {
  buildPublishBlockMessage,
  AD_TO_PAGE_MISMATCH_CLASS,
  type BlockingHitLike,
} from "./publishBlockMessage";

const mismatchHit: BlockingHitLike = {
  classId: AD_TO_PAGE_MISMATCH_CLASS,
  matched: "3/42 words shared",
  location: "ad→page",
};

const complianceHit: BlockingHitLike = {
  classId: "second_person_protected_attribute",
  matched: "your postpartum body",
  location: "body",
};

describe("publish refusal message", () => {
  it("gives the destination mismatch its own wording and does NOT blame the copy", () => {
    const msg = buildPublishBlockMessage([mismatchHit]);
    expect(msg).toContain("about different things");
    expect(msg).toContain("point the ad at the landing page for this offer");
    // The compliance wording would send the coach to rewrite copy that was never the problem.
    expect(msg).not.toContain("states things about the reader");
    expect(msg).not.toContain("Rewrite it to speak from your own experience");
  });

  it("leaves the compliance wording unchanged for compliance classes", () => {
    const msg = buildPublishBlockMessage([complianceHit]);
    expect(msg).toContain("states things about the reader, or claims your own material doesn't back up");
    expect(msg).toContain('body: "your postpartum body"');
    expect(msg).toContain("Rewrite it to speak from your own experience");
    // and says nothing about the destination, which was not the problem here
    expect(msg).not.toContain("landing page");
  });

  it("keeps the two reasons separate when both fire", () => {
    const msg = buildPublishBlockMessage([complianceHit, mismatchHit]);
    expect(msg).toContain("states things about the reader");
    expect(msg).toContain("It also points at a landing page about a different subject");
    // the mismatch hit must not leak into the compliance detail list
    expect(msg).not.toContain("ad→page");
    expect(msg).not.toContain("words shared");
  });

  it("scopes the compliance detail list to compliance hits only", () => {
    const msg = buildPublishBlockMessage([mismatchHit]);
    expect(msg).not.toContain("ad→page");
  });

  it("returns an empty string when nothing is blocking", () => {
    expect(buildPublishBlockMessage([])).toBe("");
  });

  it("caps the compliance detail at four hits", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      classId: "promised_result",
      matched: `claim ${i}`,
      location: `field${i}`,
    }));
    const msg = buildPublishBlockMessage(many);
    expect(msg).toContain("claim 3");
    expect(msg).not.toContain("claim 4");
  });
});
