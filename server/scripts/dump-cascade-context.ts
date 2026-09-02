// READ-ONLY. Prints the exact cascadeContext string the set B run prepended to
// all four title prompts, so the prompt's full input surface can be inspected.
async function main() {
  const { getCascadeContext } = await import("../_core/cascadeContext");
  const ctx = await getCascadeContext(1, 291, "hvco");
  console.log("=== CASCADE CONTEXT (userId=1, icpId=291, node=hvco) ===");
  console.log(`length=${ctx.length} chars`);
  console.log(ctx);
}
main().then(() => process.exit(0)).catch(e => { console.error("FATAL", e); process.exit(1); });
export {};
