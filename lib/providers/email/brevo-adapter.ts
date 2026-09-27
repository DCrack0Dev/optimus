import type { EmailProvider, EmailSendInput, EmailSendResult } from "./types";

interface BrevoSendResponse {
  messageId?: string;
  code?: string;
  message?: string;
}

export class BrevoAdapter implements EmailProvider {
  private apiKey: string;
  private baseUrl = "https://api.brevo.com/v3";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("Brevo API key is required");
    this.apiKey = apiKey;
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const url = `${this.baseUrl}/smtp/email`;

    const headers: Record<string, string> = {
      "api-key": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const to = [{ email: input.toEmail, name: input.toName ?? undefined }].filter(Boolean);
    const from = { email: input.fromEmail, name: input.fromName ?? undefined };

    const body: Record<string, unknown> = {
      sender: from,
      to,
      subject: input.subject,
      htmlContent: input.html ?? undefined,
      textContent: input.text ?? undefined,
      replyTo: input.replyToEmail ? { email: input.replyToEmail } : undefined,
      headers: {
        "List-Unsubscribe": input.unsubscribeToken
          ? `<${input.unsubscribeToken}>`
          : undefined,
      },
      tags: input.leadId ? [`lead:${input.leadId}`] : [],
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as BrevoSendResponse;

      if (!response.ok) {
        return {
          success: false,
          error: data.message ?? `Brevo error: ${response.status}`,
        };
      }

      return {
        success: true,
        providerMessageId: data.messageId ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

export function createBrevoAdapter(): BrevoAdapter | null {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null;
  return new BrevoAdapter(apiKey);
}