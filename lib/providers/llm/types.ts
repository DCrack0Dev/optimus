export interface LLMChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompletionResponse {
  content: string | null;
  toolCalls: LLMToolCall[] | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
}

export interface LLMProvider {
  createChatCompletion(params: {
    messages: LLMChatMessage[];
    tools?: LLMToolDef[];
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" } | { type: "text" };
  }): Promise<LLMCompletionResponse>;
}