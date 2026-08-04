/**
 * HELD-OUT catch-rate measurement of the LIVE compliance gate. Read-only. No LLM calls — the
 * compliance checker is fully deterministic, so this runs in milliseconds and costs nothing.
 *
 * WHY HELD-OUT MATTERS. Measuring a detector against the strings it was tuned on is theatre. The
 * fabrication equivalent scored 65% on audit-derived strings and 30% on novel ones — the same
 * detector, a 35-point swing purely from string provenance. So every case below is written fresh:
 * no phrase is lifted from PROTECTED_ATTRIBUTE_TERMS, from complianceAxis's own test suite, from
 * META_AD_COMPLIANCE_REFERENCE's worked examples, or from the banned-phrase table.
 *
 * Runs through the REAL gate — checkOutput(fields, grounding) — exactly as the generators call it.
 *
 * Categories are the ones the research flags as Tier-1 risk:
 *   §1.1 personal attributes · §1.3 health/weight · §1.6 deceptive urgency ·
 *   §1.7 special ad categories · §1.8 crypto/financial · house: promised results/income ·
 *   spiritual/supernatural outcomes (image-research Guardrails §6)
 */
import { checkOutput } from "../server/_core/complianceAxis";
import { buildCoachCorpus, buildProofSupplied } from "../server/_core/groundingCorpus";

const service: any = { name: "Life and wellbeing coaching", category: "coaching" };
const grounding = {
  corpus: buildCoachCorpus({ service, groundingMeta: null }),
  supplied: buildProofSupplied(service),
};

type Case = { cat: string; text: string };

/** Genuinely non-compliant copy. Every one SHOULD block. */
const VIOLATIONS: Case[] = [
  // §1.1 — second person + protected attribute (health, finance, status, ethnicity, record)
  { cat: "1.1 personal-attribute", text: "Struggling with your perimenopause symptoms and nobody is listening?" },
  { cat: "1.1 personal-attribute", text: "Is your credit score stopping you from moving forward this year?" },
  { cat: "1.1 personal-attribute", text: "Are you a single mum trying to rebuild after a divorce?" },
  { cat: "1.1 personal-attribute", text: "Still carrying the weight of your conviction years after release?" },
  { cat: "1.1 personal-attribute", text: "Does your ADHD keep derailing every system you try to build?" },
  { cat: "1.1 personal-attribute", text: "Tired of your bloating ruining every outfit you own?" },

  // §1.3 — negative self-perception / body and weight framing
  { cat: "1.3 health-weight", text: "Look in the mirror and hate what stares back? Let's change that." },
  { cat: "1.3 health-weight", text: "Drop three dress sizes before the summer without setting foot in a gym." },
  { cat: "1.3 health-weight", text: "Your belly fat is the reason you avoid photographs. It does not have to be." },
  { cat: "1.3 health-weight", text: "This programme reverses insulin resistance in twelve weeks, guaranteed." },

  // House standard — promised results / guaranteed income
  { cat: "promised-result", text: "You will double your monthly revenue within ninety days or I keep working for free." },
  { cat: "promised-result", text: "Guaranteed six figures in your first year of coaching, no exceptions." },
  { cat: "promised-result", text: "Every client who follows the system lands a promotion inside two quarters." },
  { cat: "promised-result", text: "This will absolutely fix your relationship with money, permanently." },

  // §1.6 — deceptive urgency / fabricated scarcity
  { cat: "1.6 deceptive-urgency", text: "Only two seats left and the price doubles at midnight tonight." },
  { cat: "1.6 deceptive-urgency", text: "Doors close forever in one hour — after this it never reopens." },

  // §1.7 — special ad categories (employment / credit / housing)
  { cat: "1.7 special-category", text: "Hiring now: we place graduates into six-figure recruitment roles." },
  { cat: "1.7 special-category", text: "Repair your credit file and get approved for a mortgage this quarter." },

  // §1.8 — crypto / financial services
  { cat: "1.8 crypto-financial", text: "Learn exactly which altcoins to buy before the next bull run starts." },
  { cat: "1.8 crypto-financial", text: "I will show you when to sell your Bitcoin for maximum profit." },

  // Spiritual / supernatural outcome claims (image-research Guardrails §6)
  { cat: "spiritual-outcome", text: "Clear the energetic blocks that are keeping money out of your bank account." },
  { cat: "spiritual-outcome", text: "Three sessions of energy healing will remove the curse on your family line." },
  { cat: "spiritual-outcome", text: "Your ancestors are blocking your abundance — this ritual releases it." },
  { cat: "spiritual-outcome", text: "Manifest your soulmate within one moon cycle, guaranteed by the universe." },
];

/** Genuinely compliant launch-stage copy. NONE should block. */
const CLEAN: Case[] = [
  { cat: "clean-psychology", text: "Most mid-career professionals put their own plans last, and the year runs out before the plan starts." },
  { cat: "clean-psychology", text: "The work is mostly deciding what you will stop doing." },
  { cat: "clean-method", text: "The method puts the scope conversation before the price conversation, every time." },
  { cat: "clean-method", text: "This is built for someone who has forty minutes, twice a week, and no interest in a gym." },
  { cat: "clean-offer", text: "By the end you will know what you are aiming at and what the first fortnight looks like." },
  { cat: "clean-offer", text: "Nothing here requires you to quit before you are ready." },
  { cat: "clean-firstperson", text: "I built this after watching the same pattern play out in the same order, again and again." },
  { cat: "clean-firstperson", text: "I used to reopen the same proposal four times before sending it." },
  { cat: "clean-cta", text: "Book a call and we will talk about whether this fits your week." },
  { cat: "clean-cta", text: "Have a look and see whether the shape of it makes sense for you." },
  { cat: "clean-hedged", text: "About 70% of my own training time goes on things nobody would post about." },
  { cat: "clean-hedged", text: "I am 100% certain the hardest part is the first honest conversation." },
  { cat: "clean-category", text: "Career changes stall for ordinary reasons — the calendar, the mortgage, the fear of starting again." },
  { cat: "clean-category", text: "Sleep gets harder in the second year, and most parents are told to simply wait it out." },
  { cat: "clean-wellbeing", text: "The programme is designed to support steadier energy across a normal working week." },
  { cat: "clean-wellbeing", text: "We work on habits that survive a bad night and a busy diary." },
  { cat: "clean-money", text: "The pricing conversation is the one most consultants avoid, and it is the one that decides the year." },
  { cat: "clean-money", text: "This is about building a practice you can run without burning the weekends." },
  { cat: "clean-spiritual", text: "The cards are used as a structured prompt for personal reflection." },
  { cat: "clean-spiritual", text: "Sessions create quiet space to think, with no claims about what the future holds." },
];

function blocked(text: string) {
  const res = checkOutput([{ location: "body", text, role: "body" as const }], grounding);
  // Compliance classes only — fabrication is the OTHER gate and is measured separately.
  const FAB = /^invented|^unearned|^untraceable/;
  const cmp = res.blocking.filter((h) => !FAB.test(String(h.classId)));
  return { blocked: cmp.length > 0, classes: cmp.map((h) => String(h.classId)) };
}

(async () => {
  const byCat: Record<string, { n: number; caught: number }> = {};
  const missed: Case[] = [];
  let caught = 0;

  for (const c of VIOLATIONS) {
    const r = blocked(c.text);
    byCat[c.cat] ??= { n: 0, caught: 0 };
    byCat[c.cat].n++;
    if (r.blocked) { caught++; byCat[c.cat].caught++; } else missed.push(c);
  }

  let fp = 0;
  const falsePositives: Array<Case & { classes: string[] }> = [];
  for (const c of CLEAN) {
    const r = blocked(c.text);
    if (r.blocked) { fp++; falsePositives.push({ ...c, classes: r.classes }); }
  }

  const N = VIOLATIONS.length, M = CLEAN.length;
  console.log("\n======= COMPLIANCE GATE — HELD-OUT CATCH RATE =======");
  console.log(`RECALL    ${caught}/${N} (${Math.round((caught / N) * 100)}%) of real violations blocked`);
  console.log(`PRECISION ${M - fp}/${M} clean lines passed — ${fp} false positive(s) (${Math.round((fp / M) * 100)}%)`);
  console.log("\nBy category:");
  for (const k of Object.keys(byCat)) {
    const b = byCat[k];
    console.log(`   ${k.padEnd(24)} ${b.caught}/${b.n}  (${Math.round((b.caught / b.n) * 100)}%)`);
  }
  if (missed.length) {
    console.log(`\nMISSED VIOLATIONS (${missed.length}) — these ship today:`);
    for (const m of missed) console.log(`   [${m.cat}] "${m.text.slice(0, 76)}"`);
  }
  if (falsePositives.length) {
    console.log(`\nFALSE POSITIVES (${falsePositives.length}) — clean copy wrongly blocked:`);
    for (const f of falsePositives) console.log(`   [${f.classes.join(",")}] "${f.text.slice(0, 70)}"`);
  }
  console.log("====================================================\n");
})();
