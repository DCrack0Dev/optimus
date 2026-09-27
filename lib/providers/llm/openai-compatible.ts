import type { LLMProvider, LLMChatMessage, LLMToolCall, LLMCompletionResponse, LLMToolDef } from "./types";

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    if (!apiKey) throw new Error("LLM API key is required");
    if (!baseUrl) throw new Error("LLM base URL is required");
    if (!model) throw new Error("LLM model is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.model = model;
  }

  async createChatCompletion(params: {
    messages: LLMChatMessage[];
    tools?: LLMToolDef[];
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" } | { type: "text" };
  }): Promise<LLMCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const openAIMessages: OpenAIMessage[] = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_call_id: m.tool_call_id,
      name: m.name,
      tool_calls: m.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function",
        function: tc.function,
      })),
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages: openAIMessages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 2048,
    };

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools;
      body.tool_choice = params.toolChoice ?? "auto";
    }

    if (params.responseFormat) {
      body.response_format = params.responseFormat;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    const choice = data.choices[0];
    if (!choice) {
      throw new Error("LLM API returned no choices");
    }

    const toolCalls: LLMToolCall[] | null = choice.message.tool_calls
      ? choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: tc.function,
        }))
      : null;

    return {
      content: choice.message.content,
      toolCalls,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      raw: data,
    };
  }
}

export function createLLMProvider(): LLMProvider | null {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";

  if (!apiKey) return null;
  return new OpenAICompatibleProvider(baseUrl, apiKey, model);
}