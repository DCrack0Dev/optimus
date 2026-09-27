import type {
  WhatsAppProvider,
  WhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppWebhookPayload,
  WhatsAppProviderConfig,
  WhatsAppProviderType,
} from "./types";

export class NoOpWhatsAppProvider implements WhatsAppProvider {
  name = "noop";

  async sendMessage(_message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    return {
      success: false,
      error: "WhatsApp provider not connected. Set WHATSAPP_PROVIDER and required credentials.",
    };
  }

  async getMessageStatus(_messageId: string): Promise<{ status: string; timestamp: number } | null> {
    return null;
  }

  async handleInboundWebhook(_payload: WhatsAppWebhookPayload): Promise<{ ok: boolean; processed: number; errors: string[] }> {
    return {
      ok: false,
      processed: 0,
      errors: ["WhatsApp provider not connected"],
    };
  }

  validateWebhook(_mode: string, _token: string, _challenge: string): string | null {
    return null;
  }

  async getMediaUrl(_mediaId: string): Promise<string | null> {
    return null;
  }

  async downloadMedia(_mediaUrl: string): Promise<Buffer | null> {
    return null;
  }

  async markAsRead(_messageId: string): Promise<boolean> {
    return false;
  }

  async getBusinessProfile(): Promise<{ about: string; address: string; description: string; email: string; vertical: string; website: string } | null> {
    return null;
  }
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  name = "meta";
  private config: Required<Pick<WhatsAppProviderConfig, "accessToken" | "phoneNumberId" | "businessAccountId" | "verifyToken" | "webhookSecret" | "webhookUrl">>;
  private baseUrl = "https://graph.facebook.com/v18.0";

  constructor(config: WhatsAppProviderConfig) {
    if (!config.accessToken || !config.phoneNumberId || !config.verifyToken) {
      throw new Error("Meta WhatsApp requires accessToken, phoneNumberId, and verifyToken");
    }
    this.config = {
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId ?? "",
      verifyToken: config.verifyToken,
      webhookSecret: config.webhookSecret ?? "",
      webhookUrl: config.webhookUrl ?? "",
    };
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const url = `${this.baseUrl}/${this.config.phoneNumberId}/messages`;

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: message.to,
      type: message.type,
    };

    if (message.type === "template" && message.templateName) {
      payload.template = {
        name: message.templateName,
        language: { code: message.templateLanguage ?? "en" },
        components: message.templateComponents ?? [],
      };
    } else if (message.type === "text") {
      payload.text = { body: message.body };
    } else if (["image", "document", "audio", "video", "sticker"].includes(message.type)) {
      if (!message.mediaId && !message.mediaUrl) {
        return { success: false, error: "Media ID or URL required for media messages" };
      }
      payload[message.type] = message.mediaId
        ? { id: message.mediaId, caption: message.body }
        : { link: message.mediaUrl, caption: message.body };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message ?? `Meta API error: ${response.status}`,
          status: "failed",
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: "sent",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        status: "failed",
      };
    }
  }

  async getMessageStatus(_messageId: string): Promise<{ status: string; timestamp: number } | null> {
    // Meta doesn't provide a direct status API; statuses come via webhook
    return null;
  }

  async handleInboundWebhook(payload: WhatsAppWebhookPayload): Promise<{ ok: boolean; processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { messages, statuses } = change.value;

        if (messages) {
          for (const msg of messages) {
            try {
              // Process inbound message - this would integrate with the followup/lead system
              console.log("Inbound WhatsApp message:", msg.id, msg.from, msg.type);
              processed++;
            } catch (err) {
              errors.push(`Message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        if (statuses) {
          for (const status of statuses) {
            try {
              // Update message status in database
              console.log("WhatsApp status update:", status.id, status.status);
              processed++;
            } catch (err) {
              errors.push(`Status ${status.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    return { ok: errors.length === 0, processed, errors };
  }

  validateWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === "subscribe" && token === this.config.verifyToken) {
      return challenge;
    }
    return null;
  }

  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      const data = await response.json();
      return data.url ?? null;
    } catch {
      return null;
    }
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(mediaUrl, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getBusinessProfile(): Promise<{ about: string; address: string; description: string; email: string; vertical: string; website: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.config.businessAccountId}/whatsapp_business_profile?fields=about,address,description,email,vertical,website`, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch {
      return null;
    }
  }
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(config: WhatsAppProviderConfig) {
    if (!config.accessToken || !config.phoneNumberId) {
      throw new Error("Twilio WhatsApp requires accessToken (Auth Token) and phoneNumberId (Account SID)");
    }
    this.accountSid = config.phoneNumberId;
    this.authToken = config.accessToken;
    this.fromNumber = config.webhookUrl ?? ""; // Using webhookUrl field for from number
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append("From", `whatsapp:${this.fromNumber}`);
    params.append("To", `whatsapp:${message.to}`);
    params.append("Body", message.body);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message ?? `Twilio error: ${response.status}`,
          status: "failed",
        };
      }

      return {
        success: true,
        messageId: data.sid,
        status: "sent",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        status: "failed",
      };
    }
  }

  async getMessageStatus(messageId: string): Promise<{ status: string; timestamp: number } | null> {
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages/${messageId}.json`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        },
      });
      const data = await response.json();
      return {
        status: data.status,
        timestamp: Date.parse(data.date_created),
      };
    } catch {
      return null;
    }
  }

  async handleInboundWebhook(_payload: WhatsAppWebhookPayload): Promise<{ ok: boolean; processed: number; errors: string[] }> {
    // Twilio uses different webhook format
    return { ok: false, processed: 0, errors: ["Twilio webhook handler not implemented"] };
  }

  validateWebhook(_mode: string, _token: string, _challenge: string): string | null {
    return null;
  }

  async getMediaUrl(_mediaId: string): Promise<string | null> {
    return null;
  }

  async downloadMedia(_mediaUrl: string): Promise<Buffer | null> {
    return null;
  }

  async markAsRead(_messageId: string): Promise<boolean> {
    return false;
  }

  async getBusinessProfile(): Promise<{ about: string; address: string; description: string; email: string; vertical: string; website: string } | null> {
    return null;
  }
}

export function createWhatsAppProvider(): WhatsAppProvider {
  const providerType = (process.env.WHATSAPP_PROVIDER?.toLowerCase() ?? "none") as WhatsAppProviderType;

  switch (providerType) {
    case "meta":
      return new MetaWhatsAppProvider({
        provider: "meta",
        accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
        phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? "",
        businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
        verifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN ?? "",
        webhookSecret: process.env.META_WHATSAPP_APP_SECRET ?? "",
        webhookUrl: process.env.META_WHATSAPP_WEBHOOK_URL ?? "",
      });
    case "twilio":
      return new TwilioWhatsAppProvider({
        provider: "twilio",
        accessToken: process.env.TWILIO_AUTH_TOKEN ?? "",
        phoneNumberId: process.env.TWILIO_ACCOUNT_SID ?? "",
        verifyToken: process.env.TWILIO_WHATSAPP_VERIFY_TOKEN ?? "",
        webhookUrl: process.env.TWILIO_WHATSAPP_NUMBER ?? "",
      });
    default:
      return new NoOpWhatsAppProvider();
  }
}

export type { WhatsAppProvider } from "./types";
export type { WhatsAppMessage, WhatsAppSendResult, WhatsAppWebhookPayload, WhatsAppProviderConfig, WhatsAppProviderType } from "./types";