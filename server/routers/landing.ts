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
              "You are a world-class direct-response copywriter specialising in Meta ads for coaches, consultants and speakers. Return ONLY valid JSON — no markdown, no explanation.",
          },
          {
            role: "user",
            content: `Based on this service sentence: "${serviceSentence}"

Generate three short, punchy marketing assets:
1. headline — A single Meta ad headline (max 10 words). Attention-grabbing, benefit-led, no hype words.
2. icpHook — One sentence describing the ideal customer's core pain (max 20 words). Moment-based language, specific.
3. adAngle — One ad angle in 15 words or less. Unique mechanism or contrarian take.

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

      const content = response.choices?.[0]?.message?.content ?? "{}";
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
