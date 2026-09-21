/**
 * lib-script-metrics — the quality instrument for sprint 0b. ONE implementation, applied identically to both arms
 * and to BOTH controls, so an arm difference can never be an instrument difference (§15c).
 *
 * Harness-only: nothing in the app imports this.
 */
export const STOPWORDS = new Set(`a an the and or but if then than so because as of in on at to for from with without into over under again further once here there all any both each few more most other some such no nor not only own same too very s t can will just don should now i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers herself it its itself they them their theirs themselves what which who whom this that these those am is are was were be been being have has had having do does did doing would could shall may might must about against between during before after above below up down out off through why how when where whats im dont its theyre youre thats ive youve were theres`.split(/\s+/));

export const words = (t: string): string[] =>
  String(t ?? "").toLowerCase().replace(/[‘’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);

export const contentWords = (t: string): string[] => words(t).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w && !STOPWORDS.has(w));

export const sentences = (t: string): string[] =>
  String(t ?? "").split(/(?<=[.!?])[\s\n]+/).map((s) => s.trim()).filter((s) => words(s).length > 0);

/** A fragment: no finite verb. Approximated by the absence of any verb-ish token, the same way for every script. */
const FINITE = /\b(is|are|was|were|am|be|been|being|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|'s|'re|'ve|'ll|'d)\b|\b\w+(s|ed|ing)\b/;
export const isFragment = (s: string): boolean => !FINITE.test(s.toLowerCase());

const CONTRACTION = /\b\w+'(s|re|ve|ll|d|t|m)\b/g;

export function ngrams(t: string, n: number): Set<string> {
  const w = words(t);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function jaccard(a: string, b: string, stripPhrases: string[] = []): number {
  const strip = (t: string) => stripPhrases.reduce((acc, p) => acc.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), t);
  const A = new Set(contentWords(strip(a)));
  const B = new Set(contentWords(strip(b)));
  if (!A.size && !B.size) return 0;
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

export type ScriptMetrics = {
  id: string; words: number; sentences: number; hookWords: number; longestSentence: number;
  sentenceSD: number; contractionsPer100: number; fragmentShare: number; longestFragmentRun: number;
};

export function metricsFor(id: string, text: string): ScriptMetrics {
  const ss = sentences(text);
  const lens = ss.map((s) => words(s).length);
  const n = words(text).length;
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1));
  const frags = ss.map(isFragment);
  let run = 0, best = 0;
  for (const f of frags) { run = f ? run + 1 : 0; best = Math.max(best, run); }
  return {
    id, words: n, sentences: ss.length,
    hookWords: lens[0] ?? 0,
    longestSentence: lens.length ? Math.max(...lens) : 0,
    sentenceSD: Number(sd.toFixed(2)),
    contractionsPer100: Number(((String(text).match(CONTRACTION)?.length ?? 0) * 100 / (n || 1)).toFixed(2)),
    fragmentShare: Number((frags.filter(Boolean).length / (frags.length || 1)).toFixed(2)),
    longestFragmentRun: best,
  };
}

/** Set-level: pairwise overlap and shared 4-grams. `stripPhrases` are the exempt whole phrases (presenter/method names). */
export function setMetrics(scripts: Array<{ id: string; text: string }>, stripPhrases: string[] = [], overlapCap = 0.27) {
  const pairs: Array<{ a: string; b: string; overlap: number }> = [];
  for (let i = 0; i < scripts.length; i++)
    for (let j = i + 1; j < scripts.length; j++)
      pairs.push({ a: scripts[i].id, b: scripts[j].id, overlap: jaccard(scripts[i].text, scripts[j].text, stripPhrases) });
  const counts = new Map<string, number>();
  for (const s of scripts) {
    ngrams(stripPhrases.reduce((acc, p) => acc.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " "), s.text), 4)
      .forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
  }
  const shared4: Array<{ gram: string; scripts: number }> = [];
  counts.forEach((c, g) => { if (c >= 3) shared4.push({ gram: g, scripts: c }); });
  return {
    pairs: pairs.length,
    maxOverlap: Number((Math.max(0, ...pairs.map((p) => p.overlap)) * 100).toFixed(2)),
    pairsOverCap: pairs.filter((p) => p.overlap > overlapCap).length,
    topPairs: [...pairs].sort((x, y) => y.overlap - x.overlap).slice(0, 3).map((p) => `${p.a}–${p.b} ${(p.overlap * 100).toFixed(2)}%`),
    shared4gramCount: shared4.length,
    shared4grams: shared4.sort((a, b) => b.scripts - a.scripts).slice(0, 10),
  };
}
