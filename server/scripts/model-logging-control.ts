/**
 * NEGATIVE CONTROL for the model-identity logging added to `_core/llm.ts`
 * on 2026-08-31. Read-only: makes two small LLM calls and writes NOTHING
 * to the database.
 *
 * §15k — a control must distinguish, so BOTH arms run:
 *   ARM 1 (negative): a bogus `model` override 404s at ladder position 0,
 *          forcing a fall-through. EXPECT fellThrough=true, ladder=1.
 *   ARM 2 (positive): no override. EXPECT fellThrough=false, ladder=0.
 *
 * A run where neither line appears is a FAILED control, not a pass —
 * silence must fail (§15k).
 */
async function main() {
  const { invokeLLM } = await import("../_core/llm");

  const say = (m: string) => console.log(`[CONTROL] ${m}`);

  say("ARM 1 — bogus model override, expect a 404 at ladder position 0 then fall-through");
  try {
    const r1 = await invokeLLM({
      model: "claude-bogus-model-does-not-exist-00000",
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    });
    say(`ARM 1 returned. InvokeResult.model=${r1.model}`);
  } catch (e: any) {
    say(`ARM 1 THREW: ${e?.message}`);
  }

  say("ARM 2 — no override, expect ladder position 0 and fellThrough=false");
  try {
    const r2 = await invokeLLM({
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    });
    say(`ARM 2 returned. InvokeResult.model=${r2.model}`);
  } catch (e: any) {
    say(`ARM 2 THREW: ${e?.message}`);
  }

  say("CONTROL COMPLETE");
}

main().then(() => process.exit(0)).catch((e) => { console.error("[CONTROL] FATAL", e); process.exit(1); });

// Module scope. Without this the top-level `main` collides with the identically
// named function in `e2e-bonus-teardown.ts` (TS2393 Duplicate function
// implementation) — TS treats an import-free .ts file as a global script.
// Note the error is reported against THAT file, not this one.
export {};
