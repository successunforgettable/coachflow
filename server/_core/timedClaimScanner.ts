/**
 * THE TIMED-CLAIM SCANNER — the enforcement behind CLAUDE.md §14b.
 *
 * §14b, the standing definition of what a promise attaches to:
 *   - a property of the ASSET — what the thing IS — is always allowed ("a one-page checklist")
 *   - a time attached to the READER'S OUTCOME is a claim, barred unless the coach supplied it
 *     ("ready to send the same day", "By Day 7 you will hold…")
 *
 * 🔴 WHY THIS MODULE EXISTS. The rule was already in the prompt and was already losing. Every
 * deliverable prompt appends GUARANTEE_CLAIMS_RULE, which states "what the reader will have become
 * by day thirty is a promise about them" — and the bonus path still produced "By Day 7, you will
 * hold a ranked shortlist", "send to a real person today" and "a complete sales page draft in 48
 * hours". Six of six live bonus pages carried a timed claim. An instruction with nothing enforcing
 * it is the §15i shape: a guarantee nothing enforces. This is the enforcing line.
 *
 * 📌 IT IS A DETECTOR, NOT A PROMPT. Nothing in this file is ever sent to a model as a standing
 * instruction — that would put canonical wrong shapes in front of the generator, which §14/§14a
 * bar. `timedClaimFailContext` is built from the model's OWN just-produced output and is therefore
 * the permitted corrective form: specific, post-hoc, about the output in hand.
 */

/**
 * A time attached to an outcome. Every alternative is a CLOCK — none of them describes an asset.
 *
 * 📌 "immediately" IS DELIBERATELY ABSENT. The prompts use it about the pipeline ("filled from the
 * campaign's own bonus stack immediately after this step") and about the artefact
 * ("immediately-usable", a property: no assembly required). Including it would fire on both and say
 * nothing about §14b.
 *
 * 📌 A REFUND WINDOW IS NOT IN SCOPE EITHER. "a full refund within 30 days" is a promise about
 * MONEY, which §14b and GUARANTEE_CLAIMS_RULE both allow. It is matched by `(?:in|within) \d+ days`
 * and is exempted by `MONEY_WINDOW_NEAR` below rather than by weakening the pattern.
 */
/**
 * ⚠️ WIDENED AFTER IT WAS PROVEN BLIND, ON ITS OWN OUTPUT. The first version matched only DIGIT
 * forms and only `by day N`. It passed two bodies it had just approved for publication:
 *   - bonus-35's new promise, "get words on the page in the next TEN minutes" — a spelled-out
 *     numeral, invisible to `\d+`;
 *   - bonus-42's new promise, "you LEAVE Day 7 holding three ranked directions" — a bare `Day N`
 *     with no "by" in front of it.
 * Both are times attached to the reader's outcome, which is exactly what this pattern exists to
 * catch, and both read as clean. A detector is only as good as the shapes it has been shown, so the
 * number words and the bare day form are now in it. (§15c — a check that cannot fail proves
 * nothing; here it could fail, but not on these.)
 */
const NUM = "(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty|ninety|\\d+)";
const UNIT = "(?:second|minute|hour|day|week|month)s?";
export const TIMED_CLAIM_PATTERN = new RegExp(
  [
    "\\btoday\\b", "\\btonight\\b", "\\bovernight\\b", "\\bthe same day\\b", "\\bone sitting\\b",
    "\\bhow soon\\b", "\\bstraight away\\b", "\\bright away\\b", "\\bquick win\\b", "\\bin minutes\\b",
    // "by day 7", "on day 3", "you leave Day 7" — and a bare "Day 7" standing as an outcome marker.
    "\\b(?:by|on|before|after|leaves?|leaving)\\s+day\\s*\\d+\\b",
    // "in 48 hours", "within 90 days", "in the next ten minutes", "inside a week"
    `\\b(?:in|within|inside|after)\\s+(?:the\\s+next\\s+)?${NUM}[-\\s]${UNIT}\\b`,
    `\\bnext\\s+${NUM}\\s+${UNIT}\\b`,
  ].join("|"),
  "gi",
);

/**
 * A refund/guarantee window near the hit — a promise about money, allowed by §14b.
 *
 * ⚠️ DELIBERATELY NARROW, and it was narrowed after a real miss. A first version included
 * `charge|payment|invoice`, and `charge` matched "chargeable" in bonus-43's live line "One sitting.
 * Five steps. One chargeable offer in your own words." — exempting a genuine violation because the
 * sentence happened to mention pricing. The §14b carve-out is specifically the REFUND window, so
 * only refund/guarantee vocabulary earns it.
 */
const MONEY_WINDOW_NEAR = /refund|money[- ]back|guarantee|cancellation/i;

/**
 * THE QUOTED-SPEECH EXEMPTION STOPS AT A FIGURE (Arfeen, 2026-09-13).
 *
 * 🔴 NARROWED AFTER IT PASSED A FABRICATED CLAIM. bonus-44's script has the reader say "The goal the
 * programme is built around is three paying clients within 90 days of launching". It sits inside a
 * first-person quote, so the exemption read it as scene-setting — and would have passed it again on
 * every regeneration. Arfeen ruled the figure fabricated, not coach-supplied. Who is "speaking" a
 * claimed result does not change what it claims.
 *
 * Judged on the CLAUSE the clock sits in, inside the innermost quote around it. The clock loses the
 * exemption when:
 *   - the clause carries a FIGURE besides the clock — a digit, a currency or percent sign, or a number
 *     word ("three paying clients within 90 days", "I signed three clients today"); or
 *   - the clock is itself QUANTIFIED — a counted timeframe or a deadline ("within a week", "by day 7",
 *     "one sitting") — UNLESS the clause only says WHEN AN EVENT HAPPENS ("launch is in four days").
 * A passing time word with no figure ("That yes is the only clarity I need today.") stays exempt.
 *
 * ⚠️ WHY THE EVENT-SCHEDULE CARVE-OUT. §14b: "a duration inside scene-setting prose … never bars a
 * write." The first narrowing flagged every counted timeframe in speech, and so flagged bonus-34's live
 * example anchor — "she's been avoiding for two weeks, launch is in four days" — a third-person scene,
 * not a result. A clock stated as `<thing> is in N days` schedules an event; nothing is claimed as won.
 *
 * 📌 "one", "a" and "an" are NOT figures in the clause — they are everywhere in ordinary speech
 * ("one reply", "the only one"). They still count inside the clock itself, where they quantify it.
 *
 * 📌 The clause is cut at , ; : . ! ? and dashes, inside the INNERMOST quote. bonus-35's live line
 * nests 'this was exactly what I needed today,' inside a passage mentioning "a 25% open rate"; bonus-34's
 * anchor carries "two weeks" one comma before "launch is in four days". Neither figure is the clock's.
 */
const QUANTIFIED_CLOCK = new RegExp(`\\d|\\b${NUM}\\b`, "i");
const FIGURE_IN_SPEECH =
  /\d|[$£€%]|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|hundred|thousand)\b/i;
const CLAUSE_BREAK = /[,;:.!?—–]/g;
/** The clause leading into the clock ends in a copula: `launch is`, `the call's` — an event's schedule. */
const EVENT_SCHEDULE_LEAD = /(?:\b(?:is|are|was|were)|['’]s)\s*$/i;

export type TimedClaimHit = {
  /** The matched clock, lowercased. */
  match: string;
  /** Dotted path to the string field it was found in, e.g. `items.3.detail`. */
  path: string;
  /** The line it sits on, trimmed — enough for a human to judge it. */
  line: string;
  /** Set when the hit is allowed; names which standing exemption applied. */
  exemptReason?: "quoted-speech" | "money-window";
  /** Set on a violation inside quoted speech that the exemption refused because it carries a figure. */
  quotedFigure?: true;
};

export type TimedClaimScan = {
  /** Hits that breach §14b. Non-empty means the output must not be published as it stands. */
  violations: TimedClaimHit[];
  /** Hits that matched the pattern and are allowed. Reported so a silence is never mistaken for a clean read (§15k). */
  exempt: TimedClaimHit[];
};

/**
 * Spans of quoted speech on one line.
 *
 * 🔴 DOUBLE AND SINGLE QUOTES ARE PAIRED SEPARATELY, and that is load-bearing. Real output nests
 * them — `"…one reply that said 'this was exactly what I needed today,' would I still…"` — and a
 * single sequential pass over all delimiters pairs the double-open with the single-open, leaving the
 * clock in the gap BETWEEN two spans and reporting a violation inside plain quoted speech. Pairing
 * each kind on its own and taking the union reads that line correctly.
 *
 * 📌 An apostrophe inside a word is not a delimiter. A `'` flanked by letters on both sides ("I'm",
 * "that's", "you'd") is skipped, which is what lets a single-quoted passage containing contractions
 * still be recognised as one span.
 *
 * 📌 SCOPE: spans are computed PER LINE. A quotation that opens on one line and closes on another is
 * not tracked, so a clock inside one is reported as a violation. That is the safe direction — it
 * asks a human to look, rather than exempting on a guess.
 */
function quotedSpans(line: string): Array<[number, number]> {
  const isLetter = (ch: string) => /[A-Za-z]/.test(ch);
  const collect = (chars: string[], allowIntraWordSkip: boolean): number[] => {
    const out: number[] = [];
    for (let i = 0; i < line.length; i++) {
      if (!chars.includes(line[i])) continue;
      if (allowIntraWordSkip && isLetter(line[i - 1] ?? "") && isLetter(line[i + 1] ?? "")) continue;
      out.push(i);
    }
    return out;
  };
  const spans: Array<[number, number]> = [];
  for (const [chars, skip] of [
    [['"', "“", "”"], false],
    [["'", "‘", "’"], true],
  ] as Array<[string[], boolean]>) {
    const d = collect(chars, skip);
    for (let k = 0; k + 1 < d.length; k += 2) spans.push([d[k], d[k + 1]]);
  }
  return spans;
}

/** Scan one string. `path` is carried through only so a failContext can name the field. */
export function scanTimedClaimsInString(text: string, path = ""): TimedClaimScan {
  const violations: TimedClaimHit[] = [];
  const exempt: TimedClaimHit[] = [];
  if (!text) return { violations, exempt };

  for (const rawLine of text.split("\n")) {
    const spans = quotedSpans(rawLine);
    const re = new RegExp(TIMED_CLAIM_PATTERN.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawLine)) !== null) {
      const at = m.index;
      const hit: TimedClaimHit = { match: m[0].toLowerCase(), path, line: rawLine.trim() };
      const containing = spans.filter(([a, b]) => at > a && at < b);
      if (containing.length > 0) {
        const [a, b] = containing.reduce((x, y) => (y[1] - y[0] < x[1] - x[0] ? y : x));
        const spoken = rawLine.slice(a + 1, b);
        const rel = at - (a + 1);
        const leadAll = spoken.slice(0, rel);
        const tailAll = spoken.slice(rel + m[0].length);
        let leadStart = 0;
        for (let i = 0; i < leadAll.length; i++) if (/[,;:.!?—–]/.test(leadAll[i])) leadStart = i + 1;
        const lead = leadAll.slice(leadStart);
        const tailEnd = tailAll.search(CLAUSE_BREAK);
        const tail = tailEnd === -1 ? tailAll : tailAll.slice(0, tailEnd);
        const figureInClause = FIGURE_IN_SPEECH.test(lead) || FIGURE_IN_SPEECH.test(tail);
        const quantified = QUANTIFIED_CLOCK.test(m[0]);
        if (!figureInClause && (!quantified || EVENT_SCHEDULE_LEAD.test(lead))) {
          exempt.push({ ...hit, exemptReason: "quoted-speech" });
          continue;
        }
        // Not scene-setting: a figure claimed as a result. It still earns a refund window below.
        hit.quotedFigure = true;
      }
      // A money window is judged on its immediate neighbourhood, not the whole line.
      const near = rawLine.slice(Math.max(0, at - 60), at + m[0].length + 60);
      if (MONEY_WINDOW_NEAR.test(near)) {
        exempt.push({ ...hit, exemptReason: "money-window" });
        continue;
      }
      violations.push(hit);
    }
  }
  return { violations, exempt };
}

/** Walk every string leaf of a generated body/object and scan each, carrying its dotted path. */
export function scanTimedClaims(value: unknown, basePath = ""): TimedClaimScan {
  const violations: TimedClaimHit[] = [];
  const exempt: TimedClaimHit[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") {
      const r = scanTimedClaimsInString(v, path);
      violations.push(...r.violations);
      exempt.push(...r.exempt);
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)));
    } else if (v && typeof v === "object") {
      for (const [k, item] of Object.entries(v)) walk(item, path ? `${path}.${k}` : k);
    }
  };
  walk(value, basePath);
  return { violations, exempt };
}

/**
 * The corrective retry message — built from the output just produced.
 *
 * §14a permits exactly this and bars the alternative: "Specific, post-hoc, about the output just
 * produced" is corrective and allowed; a generic canonical wrong shape carried in a standing prompt
 * primes and is banned. So this quotes the model's own sentence back at it and asks for that
 * sentence rewritten — it never illustrates a wrong shape the model has not already written.
 */
export function timedClaimFailContext(violations: TimedClaimHit[]): string {
  const shown = violations.slice(0, 6);
  const lines = shown.map((v) => {
    const where = v.path ? `field "${v.path}"` : "your previous response";
    return `- In ${where} you wrote "${v.match}" here: ${v.line.slice(0, 220)}`;
  });
  const more = violations.length > shown.length ? `\n(and ${violations.length - shown.length} more of the same kind)` : "";
  const quoted = violations.some((v) => v.quotedFigure)
    ? "Where one of those sits inside a line of quoted speech, the spoken line still names a figure, timeframe or deadline as a result — rewrite what is said so it names none."
    : "";
  return [
    `An earlier response in this run attached a timeframe to the reader's RESULT in ${violations.length} place(s):`,
    ...lines,
    more,
    "",
    "Rewrite each of those so the sentence describes what the asset IS, or what changes for the reader, with no timeframe on the reader's outcome.",
    "Describing the asset is always available to you: its length, how many steps or items or fill-in fields it holds (\"a one-page checklist\", \"eight prompts\", \"five steps\").",
    "When the reader gets a result belongs to the reader. A line of quoted speech may keep a passing time word, as long as it names no figure, timeframe or deadline as a result.",
    quoted,
    "Keep everything else about the response as it was.",
  ].filter(Boolean).join("\n");
}

/** One-line summary for a log. */
export function timedClaimSummary(scan: TimedClaimScan): string {
  const v = scan.violations.map((x) => `${x.match}@${x.path || "-"}`).slice(0, 4).join(",");
  return `${scan.violations.length} violation(s)${v ? ` [${v}]` : ""}, ${scan.exempt.length} exempt`;
}
