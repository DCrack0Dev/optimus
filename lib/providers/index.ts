import type { EmailProvider } from "./email/types";
import type { LLMProvider } from "./llm/types";
import { createBrevoAdapter } from "./email/brevo-adapter";
import { createLLMProvider } from "./llm/openai-compatible";

export function getEmailProvider(): EmailProvider | null {
  return createBrevoAdapter();
}

export function getLLMProvider(): LLMProvider | null {
  return createLLMProvider();
}

export function getWhatsAppProvider(): unknown {
  // TODO: Implement WhatsApp provider
  return null;
}

export function getVoiceProvider(): unknown {
  // TODO: Implement Voice provider
  return null;
}