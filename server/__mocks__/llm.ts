import { vi } from "vitest";

/**
 * Mock LLM responses for testing
 * Returns valid JSON without markdown wrapping
 */
export async function mockLLMResponses() {
  // Dynamically import and mock the invokeLLM function
  const llmModule = await import("../_core/llm");
  
  vi.spyOn(llmModule, "invokeLLM").mockImplementation(async ({ messages }) => {
    const systemMsg = messages.find(m => m.role === "system");
    const userMsg = messages.find(m => m.role === "user");
    
    const systemMessage = typeof systemMsg?.content === "string" ? systemMsg.content : "";
    const userMessage = typeof userMsg?.content === "string" ? userMsg.content : "";

    // Determine formula type from prompt
    let responseContent: string;

    if (userMessage.includes("story-based headlines")) {
      // Story formula: simple string array
      responseContent = JSON.stringify([
        "Mock Story Headline 1",
        "Mock Story Headline 2",
        "Mock Story Headline 3",
        "Mock Story Headline 4",
        "Mock Story Headline 5"
      ]);
    } else if (userMessage.includes("three-part headlines with eyebrow")) {
      // Eyebrow formula: {eyebrow, main, sub} objects
      responseContent = JSON.stringify([
        { eyebrow: "Mock Expert Unveils", main: "Mock Main Headline 1", sub: "Mock Subheadline 1" },
        { eyebrow: "Mock Authority Reveals", main: "Mock Main Headline 2", sub: "Mock Subheadline 2" },
        { eyebrow: "Mock Coach Discloses", main: "Mock Main Headline 3", sub: "Mock Subheadline 3" },
        { eyebrow: "Mock Guru Unveils", main: "Mock Main Headline 4", sub: "Mock Subheadline 4" },
        { eyebrow: "Mock Specialist Reveals", main: "Mock Main Headline 5", sub: "Mock Subheadline 5" }
      ]);
    } else if (userMessage.includes("question-based headlines")) {
      // Question formula: simple string array
      responseContent = JSON.stringify([
        "Mock Question Headline 1?",
        "Mock Question Headline 2?",
        "Mock Question Headline 3?",
        "Mock Question Headline 4?",
        "Mock Question Headline 5?"
      ]);
    } else if (userMessage.includes("authority-based headlines")) {
      // Authority formula: {main, sub} objects
      responseContent = JSON.stringify([
        { main: "Mock Authority Main 1", sub: "Mock Authority Sub 1" },
        { main: "Mock Authority Main 2", sub: "Mock Authority Sub 2" },
        { main: "Mock Authority Main 3", sub: "Mock Authority Sub 3" },
        { main: "Mock Authority Main 4", sub: "Mock Authority Sub 4" },
        { main: "Mock Authority Main 5", sub: "Mock Authority Sub 5" }
      ]);
    } else if (userMessage.includes("urgency-based headlines")) {
      // Urgency formula: simple string array
      responseContent = JSON.stringify([
        "Mock Urgency Headline 1!",
        "Mock Urgency Headline 2!",
        "Mock Urgency Headline 3!",
        "Mock Urgency Headline 4!",
        "Mock Urgency Headline 5!"
      ]);
    } else if (userMessage.includes("HVCO") || userMessage.includes("title")) {
      // HVCO titles
      responseContent = JSON.stringify([
        "Mock HVCO Title 1",
        "Mock HVCO Title 2",
        "Mock HVCO Title 3"
      ]);
    } else {
      // Default fallback
      responseContent = JSON.stringify([
        "Mock Response 1",
        "Mock Response 2",
        "Mock Response 3"
      ]);
    }

    return {
      id: "mock-response",
      object: "chat.completion",
      created: Date.now(),
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseContent
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    };
  });
}

/**
 * Reset LLM mocks after tests
 */
export function resetLLMMocks() {
  vi.restoreAllMocks();
}
