// Quick test to check if Manus LLM quota has reset
import { invokeLLM } from "./_core/llm";

async function testLLM() {
  try {
    console.log("Testing Manus LLM quota...");
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Say OK in one word" }],
    });
    console.log("✅ LLM QUOTA AVAILABLE - Response:", result.choices?.[0]?.message?.content);
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("usage exhausted") || msg.includes("quota")) {
      console.log("❌ LLM QUOTA STILL EXHAUSTED:", msg.substring(0, 200));
    } else {
      console.log("❌ LLM ERROR (different issue):", msg.substring(0, 200));
    }
    return false;
  }
}

testLLM();
