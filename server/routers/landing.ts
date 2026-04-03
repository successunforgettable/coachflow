import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const landingRouter = router({
  generatePreviewAssets: publicProcedure
    .input(z.object({ serviceSentence: z.string().min(5).max(500) }))
    .mutation(async ({ input }) => {
      const { serviceSentence } = input;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a world-class direct-response copywriter specialising in Meta ads for coaches, consultants and speakers. You write in the language the customer uses to describe their problem to a friend — not in marketing language. Every word must be niche-specific and grounded in the real situation of the person reading it. Return ONLY valid JSON — no markdown, no explanation.",
          },
          {
            role: "user",
            content: `Based on this service sentence: "${serviceSentence}"

Generate three short, punchy marketing assets using the customer's own language — the words they use when describing their situation to a friend, not polished marketing copy.

BANNED WORDS — never use: transformation, journey, potential, unlock, empower, breakthrough, passion, purpose, impact, fulfilment, abundance, mindset, shift, thrive, elevate, accelerate, amplify

1. headline — A single Meta ad headline (max 10 words).
   - Must contain ONE concrete, niche-specific detail (a number, a timeframe, a named problem, or an industry term)
   - Choose one ad angle: pain (name the specific daily frustration), outcome (name the exact result with a number or timeframe), curiosity (counterintuitive insight about why they're stuck), or contrast (what they're doing vs what works)
   - Could ONLY be written for THIS niche — if it works for any coach, rewrite it

2. icpHook — One sentence describing the ideal customer's core pain (max 20 words).
   - Write from the moment of pain: "It's the end of another week and you still haven't..." or "You've posted every day for three months and..."
   - Use the exact words a person in this situation would say out loud to a friend
   - Name the specific situation, not the emotion

3. adAngle — One ad angle in 15 words or less.
   - Pick one angle: unique mechanism (name a specific proprietary process), contrarian (name the common thing that doesn't work and why), or social proof (name the result a specific type of person got)
   - Must contain a niche-specific word — not "clients", "results", "success"

Return JSON exactly like this:
{"headline":"...","icpHook":"...","adAngle":"..."}`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "preview_assets",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Meta ad headline, max 10 words" },
                icpHook: { type: "string", description: "ICP pain sentence, max 20 words" },
                adAngle: { type: "string", description: "Ad angle, max 15 words" },
              },
              required: ["headline", "icpHook", "adAngle"],
              additionalProperties: false,
            },
          },
        },
      });

      const msgContent = response.choices?.[0]?.message?.content;
      // content can be a string or an array of content parts
      const rawContent: string = typeof msgContent === "string"
        ? msgContent
        : Array.isArray(msgContent)
          ? (msgContent.find((c: { type: string }) => c.type === "text") as { type: string; text: string } | undefined)?.text ?? "{}"
          : "{}";
      // Strip markdown code fences if the LLM wraps the JSON
      const content = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(content) as {
        headline: string;
        icpHook: string;
        adAngle: string;
      };

      return {
        headline: parsed.headline ?? "",
        icpHook: parsed.icpHook ?? "",
        adAngle: parsed.adAngle ?? "",
      };
    }),
});
