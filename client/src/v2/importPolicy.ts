/**
 * SKIP, MADE HONEST (Arfeen decision 5, 2026-09-27).
 *
 * "Skip — I already have this" used to record a skip and import nothing, so the kit field stayed empty, the kit
 * could never complete, and Push stayed off with no reason. Now:
 *   - Offer, Unique Method, Lead Magnet: "I already have this — use mine" asks for the coach's own version and
 *     imports it (autoMode.importAssets fills the kit field; trail.markImported marks the stop).
 *   - Headlines, Ad Copy, Landing Page: no Skip — Meta push needs them.
 */

export const IMPORT_CHIP = "I already have this — use mine";

const IMPORTABLE = new Set(["offer", "mechanism", "hvco"]);

export function canImport(step: string): boolean {
  return IMPORTABLE.has(step);
}

/** The chips under a dealable node, before its options are generated. */
export function dealChipsFor(step: string): string[] {
  return canImport(step) ? ["Show me options", IMPORT_CHIP] : ["Show me options"];
}

/** The chips when a node's options didn't come through. */
export function zeroCardChipsFor(step: string): string[] {
  return canImport(step) ? ["Try again", IMPORT_CHIP] : ["Try again"];
}

export type ImportField = { key: string; label: string; placeholder: string; required: boolean; max: number; multiline: boolean };
export type ImportForm = { title: string; fields: ImportField[] };

/** The limits match autoMode.importAssets' input schema, so a refusal happens here, in plain words, not as a server error. */
export const IMPORT_FORMS: Record<string, ImportForm> = {
  offer: {
    title: "Your offer",
    fields: [
      { key: "name", label: "What it's called", placeholder: "e.g. The 90-Day Career Pivot", required: true, max: 500, multiline: false },
      { key: "valueProposition", label: "What it gives them", placeholder: "What your client walks away with", required: true, max: 2000, multiline: true },
      { key: "cta", label: "What you ask them to do", placeholder: "Book a Free Call", required: false, max: 500, multiline: false },
    ],
  },
  mechanism: {
    title: "Your method",
    fields: [
      { key: "name", label: "What it's called", placeholder: "e.g. The Skills-to-Title Translation Method", required: true, max: 255, multiline: false },
      { key: "description", label: "How it works", placeholder: "The steps, in your words", required: true, max: 2000, multiline: true },
    ],
  },
  hvco: {
    title: "Your lead magnet",
    fields: [
      { key: "title", label: "What it's called", placeholder: "e.g. The CV Rewrite Checklist", required: true, max: 500, multiline: false },
      { key: "topic", label: "What it covers", placeholder: "What someone gets when they download it", required: true, max: 2000, multiline: true },
    ],
  },
};

export type ImportPayload =
  | { offer: { name: string; valueProposition: string; cta: string } }
  | { mechanism: { name: string; description: string } }
  | { hvco: { title: string; topic: string } };

export function buildImportPayload(
  step: string,
  values: Record<string, string | undefined>,
): { ok: true; payload: ImportPayload } | { ok: false; message: string } {
  const form = IMPORT_FORMS[step];
  if (!form) return { ok: false, message: "This step can't be imported." };
  const clean: Record<string, string> = {};
  for (const f of form.fields) {
    const v = String(values[f.key] ?? "").trim();
    if (f.required && !v) return { ok: false, message: `Add "${f.label.toLowerCase()}" to use your own.` };
    if (v.length > f.max) return { ok: false, message: `"${f.label}" is too long — keep it under ${f.max} characters.` };
    clean[f.key] = v;
  }
  if (step === "offer") return { ok: true, payload: { offer: { name: clean.name, valueProposition: clean.valueProposition, cta: clean.cta || "Book a Free Call" } } };
  if (step === "mechanism") return { ok: true, payload: { mechanism: { name: clean.name, description: clean.description } } };
  return { ok: true, payload: { hvco: { title: clean.title, topic: clean.topic } } };
}
