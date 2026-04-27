import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  // Optional per-call model override. Tried FIRST, ahead of the default
  // PREFERRED_MODELS ladder — if it returns 404/500 (e.g., a typo or
  // newly-retired ID), the existing fallback ladder catches it and the
  // call still succeeds on Sonnet 4.6 / Haiku. Used by W5 Phase 3 to
  // route landing-page body rewrites to Opus 4.7 while Phase 1/2 paths
  // continue to inherit the default Sonnet primary.
  model?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.anthropicApiKey && !ENV.forgeApiKey) {
    throw new Error("No LLM API key configured. Set ANTHROPIC_API_KEY or BUILT_IN_FORGE_API_KEY.");
  }
};

// ─── CLAUDE (ANTHROPIC) DIRECT CALL ─────────────────────────────────────────
// Converts OpenAI-style messages to Anthropic's Messages API format.
//
// JSON-shape callers (those passing responseFormat/response_format/outputSchema)
// use Anthropic's tool-use API: a synthetic tool is constructed from the
// caller's schema, the model is forced to invoke that tool, and Anthropic
// validates the model's tool-call arguments against input_schema server-side
// before returning. This is the durable fix for the schema-violation class
// of bugs (OBJECT-where-string, missing required fields, type mismatches)
// that the previous "respond-with-JSON-via-system-prompt-instruction"
// pattern could not enforce. The InvokeResult.content contract is preserved
// — for tool-use callers, the structured tool input is JSON.stringify'd back
// into content so caller-side `JSON.parse(content)` continues to work
// unchanged.
async function invokeClaudeAPI(params: InvokeParams): Promise<InvokeResult> {
  const { messages, responseFormat, response_format, outputSchema, output_schema } = params;

  // I1 diagnostic instrumentation — captures per-call latency + Anthropic's
  // self-reported metadata (model, output_tokens, stop_reason) so we can
  // diagnose the post-tool-use latency regression observed on e51aeed
  // (257s vs 60-90s baseline). Logged once per successful call below.
  // Removed when Commit B' ships.
  const fetchStartedAt = Date.now();

  // Separate system message from conversation messages
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  const systemPrompt = systemMessages
    .map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n");

  // Determine if JSON output is requested
  const needsJson = responseFormat?.type?.includes("json") ||
    response_format?.type?.includes("json") ||
    outputSchema != null ||
    output_schema != null;

  // Synthesise the Anthropic tool definition from the caller's schema.
  // Three input shapes the caller can pass:
  //   1. responseFormat / response_format = { type: "json_schema", json_schema: { name, schema } }
  //      → tool name = json_schema.name; input_schema = json_schema.schema
  //   2. outputSchema / output_schema = { name, schema }
  //      → tool name = outputSchema.name; input_schema = outputSchema.schema
  //   3. responseFormat / response_format = { type: "json_object" } (no schema)
  //      → synthesise a permissive default tool that accepts any object
  // Anthropic's tool-use API requires input_schema to have top-level type
  // "object" — every caller-supplied schema in this codebase already does.
  let toolName = "json_response";
  let toolInputSchema: Record<string, unknown> = {
    type: "object",
    additionalProperties: true,
  };
  if (needsJson) {
    const explicitFormat = responseFormat || response_format;
    const explicitSchema = outputSchema || output_schema;
    if (explicitFormat?.type === "json_schema" && explicitFormat.json_schema?.schema) {
      toolName = explicitFormat.json_schema.name || "json_response";
      toolInputSchema = explicitFormat.json_schema.schema as Record<string, unknown>;
    } else if (explicitSchema?.name && explicitSchema?.schema) {
      toolName = explicitSchema.name;
      toolInputSchema = explicitSchema.schema as Record<string, unknown>;
    }
    // else json_object with no schema: keep permissive default
  }

  const anthropicMessages = conversationMessages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  // Use latest Claude models — updated April 2026
  const DEFAULT_MODELS = [
    "claude-sonnet-4-6",          // Current Sonnet — best quality for marketing copy
    "claude-haiku-4-5-20251001",  // Current Haiku fallback
    "claude-3-haiku-20240307",    // Legacy fallback
  ];
  // If the caller passed a model override (W5 Phase 3 routes
  // landing-page body rewrites to Opus 4.7 this way), try it first; the
  // default ladder still catches a 404/500 from a bad override so a
  // typo can't break the request.
  const PREFERRED_MODELS = params.model
    ? [params.model, ...DEFAULT_MODELS.filter(m => m !== params.model)]
    : DEFAULT_MODELS;

  // Under tool-use, the schema itself communicates the expected output
  // shape — no need to also instruct the model via system-prompt text.
  // The previous "Respond with ONLY valid JSON" appendix is dropped for
  // tool-use callers (it was the only thing the JSON contract relied on
  // pre-migration; tool-use replaces it with API-level enforcement).
  const systemContent = systemPrompt || undefined;

  let response: Response | null = null;
  let lastError = "";

  for (const model of PREFERRED_MODELS) {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 8192,
      messages: anthropicMessages,
    };
    if (systemContent) body.system = systemContent;
    if (needsJson) {
      body.tools = [{
        name: toolName,
        description: "Return the structured response by invoking this tool. The tool's input_schema defines the required shape.",
        input_schema: toolInputSchema,
      }];
      body.tool_choice = { type: "tool", name: toolName };
    }

    // 5-minute timeout to prevent "fetch failed" on long generations
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ENV.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) break; // success — stop trying models

    // Extract error message from response body. Wrap in try/catch
    // because some non-200 responses (e.g., HTML error pages from a
    // proxy or upstream CDN) are not JSON-parseable; falling back to
    // statusText keeps the retry-on-404/500/529 logic reachable.
    let errMessage: string = response.statusText;
    try {
      const errData = await response.json() as any;
      errMessage = errData?.error?.message ?? response.statusText;
    } catch {
      // Non-JSON error body — keep statusText.
    }
    lastError = errMessage;

    // Auto-retry once on 529 (overloaded) with 10s delay
    if (response.status === 529) {
      console.warn(`[LLM] Claude API 529 overloaded on model ${model} — retrying in 10s...`);
      await new Promise(resolve => setTimeout(resolve, 10_000));
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), 5 * 60 * 1000);
      try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ENV.anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: retryController.signal,
        });
      } finally {
        clearTimeout(retryTimeoutId);
      }
      if (response.ok) break; // retry succeeded
      throw new Error("Claude API overloaded — please try again in a minute");
    }

    // Retry on model-not-found (404) or server error (500 — deprecated models return 500, not 404)
    // Propagate all other errors (401, 400, 429, 529-handled-above) immediately
    if (response.status !== 404 && response.status !== 500) {
      throw new Error(`Claude API failed: ${response.status} – ${lastError}`);
    }
  }
  // (end of model retry loop)

  if (!response || !response.ok) {
    throw new Error(`Claude API failed on all models: ${lastError}`);
  }

  const claudeResponse = await response.json() as any;

  // I1 diagnostic instrumentation — log per-call latency + Anthropic
  // metadata. End-to-end wall-time INCLUDES any model-fallback retries
  // and the 529-overloaded retry; if the number is inflated, the per-
  // attempt breakdown can be inferred from elapsed time vs single-call
  // expected latency. Removed in Commit B'.
  const wallMs = Date.now() - fetchStartedAt;
  console.log(
    `[invokeLLM] model=${claudeResponse.model ?? "?"} ` +
    `output_tokens=${claudeResponse.usage?.output_tokens ?? "?"} ` +
    `input_tokens=${claudeResponse.usage?.input_tokens ?? "?"} ` +
    `stop_reason=${claudeResponse.stop_reason ?? "?"} ` +
    `wall_ms=${wallMs}`,
  );

  // Extract content. For tool-use callers, find the tool_use block in
  // the response's content array and JSON.stringify its `input` field
  // back into the InvokeResult.content slot — preserves the existing
  // caller contract that response.choices[0].message.content is a
  // JSON-stringified object that callers can JSON.parse. For plain-text
  // callers, fall back to the first text block.
  let contentString: string;
  if (needsJson) {
    const blocks: Array<{ type?: string; input?: unknown; text?: string }> = claudeResponse.content || [];
    const toolUseBlock = blocks.find(b => b?.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.input == null) {
      throw new Error(
        `Anthropic tool-use response missing tool_use block. ` +
        `Got block types: [${blocks.map(b => b?.type ?? "unknown").join(",")}]. ` +
        `model=${claudeResponse.model} stop_reason=${claudeResponse.stop_reason}`
      );
    }
    contentString = JSON.stringify(toolUseBlock.input);
  } else {
    contentString = claudeResponse.content?.[0]?.text ?? "";
  }

  // Convert Anthropic response format to OpenAI-compatible InvokeResult
  return {
    id: claudeResponse.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: claudeResponse.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: contentString,
        },
        finish_reason: claudeResponse.stop_reason === "end_turn" ? "stop" : claudeResponse.stop_reason,
      },
    ],
    usage: {
      prompt_tokens: claudeResponse.usage?.input_tokens ?? 0,
      completion_tokens: claudeResponse.usage?.output_tokens ?? 0,
      total_tokens: (claudeResponse.usage?.input_tokens ?? 0) + (claudeResponse.usage?.output_tokens ?? 0),
    },
  } as InvokeResult;
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  // Use Claude (Anthropic) as primary LLM — reliable, no quota surprises
  if (ENV.anthropicApiKey) {
    return invokeClaudeAPI(params);
  }

  // Fallback to Manus Forge if no Anthropic key configured
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
