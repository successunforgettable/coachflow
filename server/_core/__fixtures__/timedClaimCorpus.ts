/**
 * THE CALIBRATION CORPUS — the real text that was live on production on 2026-09-12.
 *
 * Captured by fetching the six published bonus pages and copied in verbatim, never retyped. These
 * are the strings the scanner is judged against: a detector that cannot see these cannot certify
 * anything (§15k), and one that flags the quoted-speech entries would strip scene-setting prose
 * that §14b explicitly allows.
 */

/** Clear §14b violations — a time attached to the reader's outcome. The scanner MUST flag every one. */
export const LIVE_VIOLATIONS: Record<string, string> = {
  v33: "Use this checklist to go from blank document to complete sales page draft in 48 hours. Every item is a concrete task you can complete today, right now, with your offer details in front of you.",
  v42: "By Day 7, you will hold a ranked shortlist of no more than three directions — with the evidence to know which one carries real authority and which ones you only liked the feeling of. You arrive at the workshop already knowing your answer, not still searching for it.",
  v43a: "Follow the five steps in order and you finish holding a single-paragraph offer you can name out loud and send to a real person today. That paragraph is the foundation every other action in this programme builds on.",
  v43b: "One sitting. Five steps. One chargeable offer in your own words.",
  v34: "Follow these steps immediately after you finish filling in the 12-Prompt Template — this is how you turn a completed document into live copy within the same day.",
  v44: "You now have the exact sentences to say when doubt speaks first, when your partner asks 'are you sure yet?', and when someone in your network asks what you do — before you have a polished answer. Each script is ready to use today, as-is.",
  v35: "You've got the scripts — now the fastest way to make them stick is to use one in a live writing session before the end of today. Go back to your programme dashboard and open Module 1 of The Client Psychology Reverse-Map. Run the Stuck-Session Reset SOP alongside whatever copy you're working on, and use your Discovery-Call-to-Copy Translation Template to feed the first exercise in the module. You don't need to be ready. You need to be open.",
};

/** Quoted speech — a duration inside scene-setting prose. §14b: NOT a promise. MUST stay exempt. */
export const LIVE_EXEMPT: Record<string, string> = {
  x43: "\"I want to think about it overnight\"",
  x35a: "\"If my email had a 25% open rate and one reply that said 'this was exactly what I needed today,' would I still think it was bad? Because that is a realistic outcome for what I just sent. I will wait for actual responses before I decide it failed.\"",
  x35b: "\"I wrote something and put it in front of real people. That is the whole job. The copy gets better by publishing, not by not publishing. I did the thing today.\"",
  x44: "'So the question I'm actually answering right now is not 'is my niche ready?' The question is: 'am I willing to let someone else help me find it?' And I already said yes to that. That yes is the only clarity I need today.'",
  // Captured from the live bonus-34 page on 2026-09-13. A counted timeframe that schedules an event in a
  // third-person scene — the first narrowing of the exemption wrongly flagged it.
  x34: "Example anchor: \"It's 9pm on a Sunday, she's staring at a half-written sales page she's been avoiding for two weeks, launch is in four days, and she just read her own headline back and it sounds exactly like every other coach on Instagram.\"",
};

/**
 * A time on the READER'S ACTION — not a §14b claim (Arfeen, ruling confirmed 2026-09-13). MUST be exempt.
 *
 * Captured verbatim from the read-only bonus-35/44 diagnostic, 2026-09-13 (docs/handovers/item15-diag-2026-09-13):
 * the first version of the scanner rejected all three, and the node could not tell why.
 */
export const LIVE_ACTION_TIMING: Record<string, string> = {
  a44follow: "3. **Follow up within 48 hours** — even just: *\"Great to reconnect — I'll keep you posted as my offer takes shape.\"*",
  a44complete: "Complete this within an hour of any network conversation where you used one of the scripts above. One page, five questions. The answers feed directly into your Career Layer Excavation work inside the programme.",
  a35run: "Run this within 24 hours of publishing any piece of copy — sales page, email, or invitation — when the post-publish spiral starts. Go through it in order. Stop when the spiral stops.",
};

/**
 * Quoted speech that CLAIMS A FIGURE AS A RESULT — NOT scene-setting. MUST be flagged.
 *
 * Captured from the live bonus-44 page on 2026-09-13. The page renders `[INVESTMENT AMOUNT]` as its
 * own element, so the line is rejoined here exactly as the body stores it. Arfeen ruled the 90-day
 * figure fabricated, not coach-supplied; the first version of the exemption passed it.
 */
export const LIVE_QUOTED_OUTCOME_FIGURES: Record<string, string> = {
  q44: "'It's [INVESTMENT AMOUNT]. The goal the programme is built around is three paying clients within 90 days of launching — clients in my former field, at a consulting or coaching fee, not a salaried role. If that happens, the investment is recovered inside the first month of client work. I'm treating this as a business cost, not a personal expense — because that's what it is.'",
};
