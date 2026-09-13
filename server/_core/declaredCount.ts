/**
 * THE DECLARED-COUNT GATE — item 15, 2026-09-14.
 *
 * 🔴 WHY. bonus-35 went live promising "These seventeen scripts" and delivering 13. The count was not the model's
 * invention: the bonus `description` — handed to the body generator as its MUST-MATCH brief — says "hands you
 * seventeen pre-written self-coaching prompts and perspective-shift scripts". Nothing linked that number to the
 * structured content, and `applyBodyBounds` cut a 5,142-character script bank to its 4,000 cap without knowing what
 * it removed. Replaying the same trim on a diagnostic body that DID deliver all 17 deletes scripts 16 and 17.
 *
 * The same shape was already live twice before this gate existed (measured 2026-09-14): bonus-34 promises "all
 * twelve prompts" and holds 9; bonus-43 promises "five steps" and holds 3. Both bank tools end just under the cap.
 *
 * So: parse the count the BRIEF states, count the distinct items the TRIMMED body delivers, and refuse a body that
 * delivers fewer. Checked after `applyBodyBounds`, so a trim that cuts below the declared count fails the attempt.
 *
 * 📌 BOTH INSTRUMENTS FAIL CLOSED, by construction, never open:
 *   - the parser recognises a count only when a DELIVERABLE noun follows the number within a few words. "one to
 *     three sentences", "fifteen minutes", "a 7-day diagnostic", "three critical conversations" declare nothing.
 *   - the counter recognises an item only as a line-start heading ("## Step 3", "**Script A1**") of the declared noun
 *     family with real content under it. A heading with nothing under it (bonus-35's 404-character stub) and a
 *     passing mention inside a table row or a bullet ("(Script 15 or 16)", "Return to SOP Step 5c") never count.
 *   An item written in a shape the counter cannot see is under-counted → the attempt fails and says what it counted.
 *   That costs an attempt; a mis-parse that passed would publish a contradiction.
 */

export type ItemFamily = "script" | "template" | "swipe" | "question" | "step" | "task" | "field" | "tool";
export type DeclaredCount = { count: number; family: ItemFamily; phrase: string };

const FAMILY_NOUNS: Record<ItemFamily, string[]> = {
  script: ["script", "prompt", "reframe"],
  template: ["template"],
  swipe: ["swipe", "email", "message", "caption", "headline"],
  question: ["question"],
  step: ["step"],
  task: ["task", "micro-task", "item", "check", "checkpoint"],
  field: ["field"],
  tool: ["tool"],
};
const NOUN_TO_FAMILY = new Map<string, ItemFamily>(
  (Object.entries(FAMILY_NOUNS) as Array<[ItemFamily, string[]]>).flatMap(([f, nouns]) => nouns.map((n) => [n, f] as [string, ItemFamily])),
);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50,
};
/** A word between the number and the noun that ends the phrase: the number is not counting what follows. */
const STOPPERS = new Set(["to", "of", "in", "within", "by", "for", "at", "from", "or", "than", "per", "a", "an", "the", "each", "every"]);
const LOOKAHEAD_WORDS = 4;

function singular(word: string): string {
  const w = word.toLowerCase().replace(/[’']/g, "'");
  if (NOUN_TO_FAMILY.has(w)) return w;
  if (w.endsWith("s") && NOUN_TO_FAMILY.has(w.slice(0, -1))) return w.slice(0, -1);
  return w;
}

/** Every count the text declares for a deliverable item family. The largest count per family wins. */
export function parseDeclaredCounts(text: string): DeclaredCount[] {
  const found = new Map<ItemFamily, DeclaredCount>();
  if (!text) return [];
  for (const clause of text.split(/[.;:!?—–()\n]/)) {
    const tokens = clause.split(/[\s,]+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      // "12-item" carries its number and its noun in one token.
      const [head, ...rest] = tokens[i].split("-");
      const n = /^\d+$/.test(head) ? Number(head) : NUMBER_WORDS[head.toLowerCase()];
      if (n === undefined || n < 2) continue;
      const following = [...(rest.length ? [rest.join("-")] : []), ...tokens.slice(i + 1, i + 1 + LOOKAHEAD_WORDS)];
      for (const raw of following) {
        const word = raw.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, "");
        if (!word) break;
        if (STOPPERS.has(word.toLowerCase())) break;
        const family = NOUN_TO_FAMILY.get(singular(word));
        if (family) {
          const prior = found.get(family);
          if (!prior || n > prior.count) found.set(family, { count: n, family, phrase: `${tokens[i]} … ${word}` });
          break;
        }
      }
    }
  }
  return Array.from(found.values());
}

type Delivered = { delivered: number; labels: string[] };

/** Distinct items of `family` the structured body delivers, with real content under each. */
export function countDeliveredItems(format: string, body: any, family: ItemFamily): Delivered {
  if (!body || typeof body !== "object") return { delivered: 0, labels: [] };
  if (format === "toolkit" && family === "tool") {
    const n = Array.isArray(body.tools) ? body.tools.length : 0;
    return { delivered: n, labels: [`${n} tools`] };
  }
  if (format === "checklist" && (family === "task" || family === "step")) {
    const n = Array.isArray(body.items) ? body.items.length : 0;
    return { delivered: n, labels: [`${n} items`] };
  }
  if (format === "guide" && family === "step") {
    const n = Array.isArray(body.sections) ? body.sections.length : 0;
    return { delivered: n, labels: [`${n} sections`] };
  }
  const entries: any[] = body.tools ?? body.items ?? body.sections ?? [];
  const texts = (Array.isArray(entries) ? entries : []).map((e) => String(e?.content ?? e?.detail ?? e?.body ?? ""));
  const nouns = FAMILY_NOUNS[family].map((n) => n.replace("-", "\\-")).join("|");
  const HEADING = new RegExp(`^[ \\t]*(?:#{1,6}[ \\t]*|\\*\\*[ \\t]*)(${nouns})[ \\t]+([A-Z]?\\d+[a-z]?)\\b`, "i");
  const ANY_HEADING = /^[ \t]*(?:#{1,6}[ \t]|---\s*$|\*\*[ \t]*[A-Za-z-]+[ \t]+[A-Z]?\d+[a-z]?\b)/;
  // ⚠️ PER NOUN, LARGEST SET — NEVER THE SUM. A family holds several nouns ("script", "prompt", "reframe") because a
  // brief may say either. Summing them over-counted a real body: diagnostic attempt 3 delivered Script A1–C5 (17) in
  // one tool and a worksheet of PROMPT 1–5 reflection questions in another, and the sum read 22 — enough to pass a
  // 17 that was only just met, or a higher count that was not. The largest single set can under-count a genuinely
  // mixed bank, which fails closed.
  const byNoun = new Map<string, Set<string>>();
  for (const text of texts) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = HEADING.exec(lines[i]);
      if (!m) continue;
      let content = "";
      for (let j = i + 1; j < lines.length && !ANY_HEADING.test(lines[j]); j++) content += lines[j];
      if (content.replace(/[\s*_>|`\-]/g, "").length < 20) continue;
      const noun = m[1].toLowerCase();
      if (!byNoun.has(noun)) byNoun.set(noun, new Set());
      byNoun.get(noun)!.add(`${noun} ${m[2].toUpperCase()}`);
    }
  }
  let largest: Set<string> = new Set();
  byNoun.forEach((set) => { if (set.size > largest.size) largest = set; });
  return { delivered: largest.size, labels: Array.from(largest) };
}

/** One fault per declared count the body falls short of, naming what it did deliver. */
export function declaredCountFaults(format: string, body: any, declared: DeclaredCount[]): string[] {
  const faults: string[] = [];
  for (const d of declared) {
    const { delivered, labels } = countDeliveredItems(format, body, d.family);
    if (delivered < d.count) {
      const shown = labels.length > 8 ? `${labels.slice(0, 4).join(", ")} … ${labels.slice(-2).join(", ")}` : labels.join(", ") || "none";
      faults.push(
        `the brief declares ${d.count} ${FAMILY_NOUNS[d.family][0]}s and the body delivers ${delivered} with content (${shown}) — ` +
        `write all ${d.count}, each as its own headed entry with its content in full; each tool's content holds at most 4000 characters, so spread them across tools rather than into one`,
      );
    }
  }
  return faults;
}
