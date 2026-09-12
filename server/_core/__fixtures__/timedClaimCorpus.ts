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
};
