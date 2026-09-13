import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// llm.ts reads the key when it is first imported, and the import below is hoisted above any hook.
vi.hoisted(() => { process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key"; });
import { schemaFor, leadMagnetRequest, type MagnetContext } from "../leadMagnetContentGenerator";
import { toStrictToolSchema } from "./llm";

/**
 * ITEM 15 — STRICT TOOL USE FOR LEAD-MAGNET BODIES (2026-09-13).
 *
 * The read-only capture of bonus-35/44 found `tools` returned as TEXT on 3 of 6 attempts, and that text
 * was not valid JSON (a bare opening quote before quoted speech; a markdown `\_` escape). Strict tool use
 * constrains sampling to the schema. These tests prove the three things that make it safe to switch on:
 * the schema sent is one the strict grammar accepts, only the opted-in caller changes, and a refused
 * schema degrades to the old request instead of failing the generation.
 */

const UNSUPPORTED = ["maxLength", "minLength", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];

/** Every way a schema breaks the strict subset. A POSITIVE list of faults, so an empty list is a finding (§15k). */
function strictFaults(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => strictFaults(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const faults: string[] = [];
  for (const k of UNSUPPORTED) if (k in o) faults.push(`${path}.${k}`);
  if (typeof o.minItems === "number" && o.minItems > 1) faults.push(`${path}.minItems=${o.minItems}`);
  if (o.type === "object" && o.additionalProperties !== false) faults.push(`${path}.additionalProperties`);
  for (const [k, v] of Object.entries(o)) {
    if (k === "properties" && v && typeof v === "object") {
      for (const [name, sub] of Object.entries(v)) faults.push(...strictFaults(sub, `${path}.properties.${name}`));
    } else if (k !== "enum" && k !== "const" && k !== "required") {
      faults.push(...strictFaults(v, `${path}.${k}`));
    }
  }
  return faults;
}

const schemaOf = (rf: any) => rf.json_schema.schema;
const VARIANTS = (["guide", "checklist", "toolkit", "quiz"] as const).flatMap((f) =>
  (["lead_magnet", "bonus"] as const).flatMap((m) => [false, true].map((linked) => ({ f, m, linked }))));

describe("toStrictToolSchema — the schema sent is inside the strict subset", () => {
  it("negative control: every lead-magnet schema as written BREAKS the strict subset", () => {
    for (const { f, m, linked } of VARIANTS) expect(strictFaults(schemaOf(schemaFor(f, m, { linked }))).length).toBeGreaterThan(0);
  });

  it("after the transform, every format × mode × linked variant has zero faults", () => {
    for (const { f, m, linked } of VARIANTS) {
      expect({ variant: `${f}/${m}/${linked}`, faults: strictFaults(toStrictToolSchema(schemaOf(schemaFor(f, m, { linked })))) })
        .toEqual({ variant: `${f}/${m}/${linked}`, faults: [] });
    }
  });

  it("each removed bound is written into that field's description, so the model still sees it", () => {
    const s: any = toStrictToolSchema(schemaOf(schemaFor("toolkit", "bonus")));
    expect(s.properties.tools.minItems).toBe(1);
    expect(s.properties.tools.description).toMatch(/at least 3 items/i);
    expect(s.properties.tools.description).toMatch(/at most 4 items/i);
    expect(s.properties.tools.items.properties.content.description).toMatch(/at most 4000 characters/i);
    expect(s.properties.tools.items.properties.type.enum).toEqual(["swipe", "template", "sop", "worksheet", "script", "checklist"]);
    expect(s.required).toEqual(schemaOf(schemaFor("toolkit", "bonus")).required);
  });

  it("never mutates the caller's schema", () => {
    const original = schemaOf(schemaFor("quiz", "lead_magnet"));
    const before = JSON.stringify(original);
    toStrictToolSchema(original);
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe("the lead-magnet request opts in", () => {
  const ctx = {
    niche: "mid-career professionals", title: "A Script Bank", programme: "The Pivot", mainBenefit: "", mechanism: "",
    offerDescription: "", icpPains: "", icpGoals: "", icpBarriers: "", sot: "", contentBrief: "",
  } as MagnetContext;

  it("every attempt's request carries strictToolUse: true and the same schema as before", () => {
    const r = leadMagnetRequest("toolkit", ctx, "bonus", false, "");
    expect(r.strictToolUse).toBe(true);
    expect(r.response_format).toEqual(schemaFor("toolkit", "bonus", { linked: false }));
  });
});

describe("invokeLLM — what reaches the API", () => {
  const bodies: any[] = [];
  let queue: Response[] = [];
  const ok = () => new Response(JSON.stringify({
    id: "msg_1", model: "claude-sonnet-4-6", stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tu_1", name: "lead_magnet_toolkit", input: { promise: "p", tools: [] } }],
    usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200 });
  const bad = () => new Response(JSON.stringify({ error: { message: "schema not supported" } }), { status: 400, statusText: "Bad Request" });

  beforeEach(() => {
    bodies.length = 0;
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => { bodies.push(JSON.parse(init.body)); return queue.shift()!; }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const call = async (strictToolUse?: boolean) => {
    const { invokeLLM } = await import("./llm");
    return invokeLLM({ messages: [{ role: "user", content: "x" }], response_format: schemaFor("toolkit", "bonus"), strictToolUse });
  };

  it("opted in: the tool carries strict: true and the strict-subset schema", async () => {
    queue = [ok()];
    await call(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].tools[0].strict).toBe(true);
    expect(strictFaults(bodies[0].tools[0].input_schema)).toEqual([]);
    expect(bodies[0].tool_choice).toEqual({ type: "tool", name: "lead_magnet_toolkit" });
  });

  it("NOT opted in: the request is exactly as before — even though json_schema.strict is true on this schema", async () => {
    queue = [ok()];
    await call(undefined);
    expect(bodies[0].tools[0]).not.toHaveProperty("strict");
    expect(bodies[0].tools[0].input_schema).toEqual(schemaOf(schemaFor("toolkit", "bonus")));
  });

  it("a refused strict schema retries the same model once, non-strict, and says so", async () => {
    queue = [bad(), ok()];
    const r = await call(true);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].model).toBe(bodies[1].model);
    expect(bodies[0].tools[0].strict).toBe(true);
    expect(bodies[1].tools[0]).not.toHaveProperty("strict");
    expect(bodies[1].tools[0].input_schema).toEqual(schemaOf(schemaFor("toolkit", "bonus")));
    expect(JSON.parse(r.choices[0].message.content as string).promise).toBe("p");
    expect((console.warn as any).mock.calls.flat().join(" ")).toContain("[LLM][strict]");
  });

  it("control: a non-strict 400 still throws, as it always did", async () => {
    queue = [bad()];
    await expect(call(undefined)).rejects.toThrow(/400/);
    expect(bodies).toHaveLength(1);
  });
});
