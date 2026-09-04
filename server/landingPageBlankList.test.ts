import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PAGE_TYPE_TEMPLATE_SOURCES } from "./lib/templates/pageTypeRenderFields";

const GEN_PATH = join(__dirname, "landingPageGenerator.ts");
const TEMPLATE_DIR = join(__dirname, "lib", "templates");
const GEN_SRC = readFileSync(GEN_PATH, "utf8");

/** Pull each pageType's prompt block out of PAGETYPE_PROMPTS. */
function promptBlocks(): Record<string, string> {
  const start = GEN_SRC.indexOf("const PAGETYPE_PROMPTS");
  expect(start).toBeGreaterThan(-1);
  const region = GEN_SRC.slice(start);
  const out: Record<string, string> = {};
  for (const m of region.matchAll(/^ {2}(\w+): `([\s\S]*?)`,$/gm)) out[m[1]] = m[2];
  return out;
}

/** The field names a block tells the model to return empty. */
function blankedFields(block: string): string[] {
  const marker = "SECTIONS TO LEAVE EMPTY";
  const i = block.indexOf(marker);
  if (i === -1) return [];
  const fields: string[] = [];
  for (const line of block.slice(i).split("\n").slice(1)) {
    const m = line.match(/^- (\w+):/);
    if (m) { fields.push(m[1]); continue; }
    if (line.trim() === "") continue;
    break;
  }
  return fields;
}

const templateSrc = (file: string): string => {
  const p = join(TEMPLATE_DIR, file);
  expect(existsSync(p), `declared template source is missing: ${file}`).toBe(true);
  return readFileSync(p, "utf8");
};

/** Does this template read `content.<field>`? That is the render-side slot. */
const rendersField = (src: string, field: string) =>
  new RegExp(`content\\.${field}\\b`).test(src);

describe("landing page blank lists must match what the renderer can display", () => {
  const blocks = promptBlocks();

  // §15k — a parser that silently found nothing would make every assertion below vacuous.
  // These make silence FAIL rather than pass.
  it("the parser actually finds the prompt blocks and their blank lists", () => {
    expect(Object.keys(blocks).length).toBeGreaterThanOrEqual(5);
    for (const pt of Object.keys(PAGE_TYPE_TEMPLATE_SOURCES)) {
      expect(blocks[pt], `no prompt block parsed for ${pt}`).toBeTruthy();
    }
    const total = Object.values(blocks).reduce((n, b) => n + blankedFields(b).length, 0);
    expect(total, "parsed zero blanked fields across all page types").toBeGreaterThan(10);
  });

  it("every declared template source exists and every pageType is covered", () => {
    for (const [pt, files] of Object.entries(PAGE_TYPE_TEMPLATE_SOURCES)) {
      expect(files.length, `${pt} declares no template source`).toBeGreaterThan(0);
      for (const f of files) expect(templateSrc(f).length).toBeGreaterThan(0);
    }
  });

  /**
   * Desyncs that existed before the 2026-09-05 webinar fix and were deliberately NOT touched by
   * it — the sprint was scoped to the webinar method band. Each is a prompt telling the model to
   * blank a field its own template renders, i.e. a section that can never appear on that page.
   * They are recorded, not endorsed. THIS LIST MAY ONLY SHRINK: a new desync fails the test, and
   * so does an entry that is no longer true, so fixing one forces the record to be updated.
   */
  const ACCEPTED_DESYNCS = [
    'event_registration: prompt blanks "guarantee" but eventImanGadzhi.ts renders content.guarantee',
    'event_registration: prompt blanks "problemAgitation" but eventHormozi.ts renders content.problemAgitation',
    'event_registration: prompt blanks "problemAgitation" but eventImanGadzhi.ts renders content.problemAgitation',
    'event_registration: prompt blanks "solutionIntro" but eventHormozi.ts renders content.solutionIntro',
    'event_registration: prompt blanks "testimonials" but eventHormozi.ts renders content.testimonials',
    'event_registration: prompt blanks "timeSavingBenefit" but eventHormozi.ts renders content.timeSavingBenefit',
    'event_registration: prompt blanks "whyOldFail" but eventHormozi.ts renders content.whyOldFail',
    'event_registration: prompt blanks "whyOldFail" but eventImanGadzhi.ts renders content.whyOldFail',
    'lead_magnet_download: prompt blanks "solutionIntro" but burchardProductivity.ts renders content.solutionIntro',
    'webinar_registration: prompt blanks "problemAgitation" but webinarLight.ts renders content.problemAgitation',
    'webinar_registration: prompt blanks "problemAgitation" but webinarRajsekar.ts renders content.problemAgitation',
    'webinar_registration: prompt blanks "solutionIntro" but webinarLight.ts renders content.solutionIntro',
    'webinar_registration: prompt blanks "solutionIntro" but webinarRajsekar.ts renders content.solutionIntro',
  ].sort();

  function currentViolations(): string[] {
    const violations: string[] = [];
    for (const [pt, files] of Object.entries(PAGE_TYPE_TEMPLATE_SOURCES)) {
      const blanked = blankedFields(blocks[pt] ?? "");
      for (const field of blanked) {
        for (const f of files) {
          if (rendersField(templateSrc(f), field)) {
            violations.push(`${pt}: prompt blanks "${field}" but ${f} renders content.${field}`);
          }
        }
      }
    }
    return violations.sort();
  }

  it("no NEW field is blanked for a pageType whose template renders it", () => {
    const now = currentViolations();
    expect(now.filter(v => !ACCEPTED_DESYNCS.includes(v))).toEqual([]);
  });

  it("the accepted-desync record carries no stale entry", () => {
    const now = currentViolations();
    expect(ACCEPTED_DESYNCS.filter(v => !now.includes(v))).toEqual([]);
  });

  it("the webinar mechanism desync is gone from the record and from the code", () => {
    const now = currentViolations();
    expect(now.some(v => v.includes("uniqueMechanism"))).toBe(false);
    expect(now.some(v => v.startsWith("webinar_registration") && v.includes("whyOldFail"))).toBe(false);
  });

  // The specific regression, asserted positively rather than as an absence.
  it("webinar populates the method band, and webinarLight has the slots for it", () => {
    const blanked = blankedFields(blocks.webinar_registration ?? "");
    expect(blanked).not.toContain("uniqueMechanism");
    expect(blanked).not.toContain("whyOldFail");
    const light = templateSrc("webinarLight.ts");
    expect(rendersField(light, "uniqueMechanism")).toBe(true);
    expect(rendersField(light, "whyOldFail")).toBe(true);
    // The binding must be stated in the prompt, not merely un-blanked.
    expect(blocks.webinar_registration).toContain("Selected hero mechanism");
  });

  // The three page types whose templates have no mechanism slot stay blanked, deliberately.
  it("discovery, lead-magnet and event still blank the mechanism, matching their templates", () => {
    for (const pt of ["discovery_call_booking", "lead_magnet_download", "event_registration"]) {
      expect(blankedFields(blocks[pt] ?? ""), `${pt}`).toContain("uniqueMechanism");
      for (const f of PAGE_TYPE_TEMPLATE_SOURCES[pt as keyof typeof PAGE_TYPE_TEMPLATE_SOURCES]) {
        expect(rendersField(templateSrc(f), "uniqueMechanism"), `${f}`).toBe(false);
      }
    }
  });

  // §15c — a check that cannot fail proves nothing. Feed the checker the shape it exists to
  // reject and confirm it rejects it.
  it("NEGATIVE CONTROL: the checker flags a blanked field the template does render", () => {
    const light = templateSrc("webinarLight.ts");
    expect(rendersField(light, "uniqueMechanism")).toBe(true);
    const pretendBlanked = ["uniqueMechanism"];
    const violations = pretendBlanked.filter(f => rendersField(light, f));
    expect(violations).toEqual(["uniqueMechanism"]);
  });
});
