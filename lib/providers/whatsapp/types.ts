export interface WhatsAppMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  type: "text" | "image" | "document" | "audio" | "video" | "sticker" | "location" | "contacts" | "template";
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  timestamp: number;
  mediaUrl?: string;
  mediaId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: WhatsAppTemplateComponent[];
  context?: {
    messageId: string;
  };
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "footer" | "button";
  parameters?: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
    video?: { link: string };
  }>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: "sent" | "failed" | "pending";
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
          audio?: { id: string; mime_type: string; sha256: string; voice?: boolean };
          video?: { id: string; mime_type: string; sha256: string; caption?: string };
          sticker?: { id: string; mime_type: string; sha256: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          contacts?: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string; type: string }> }>;
          context?: { from: string; id: string };
          reaction?: { message_id: string; emoji: string };
          button?: { text: string; payload: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string; description: string };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          conversation?: { id: string; expiration_timestamp: string; origin: { type: string } };
          pricing?: { billable: boolean; pricing_model: string; category: string };
          errors?: Array<{ code: number; title: string; details: string; error_data?: { details: string } }>;
        }>;
        errors?: Array<{ code: number; title: string; details: string; error_data?: { details: string } }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppProvider {
  name: string;
  sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
  getMessageStatus(messageId: string): Promise<{ status: string; timestamp: number } | null>;
  handleInboundWebhook(payload: WhatsAppWebhookPayload): Promise<{ ok: boolean; processed: number; errors: string[] }>;
  validateWebhook(mode: string, token: string, challenge: string): string | null;
  getMediaUrl(mediaId: string): Promise<string | null>;
  downloadMedia(mediaUrl: string): Promise<Buffer | null>;
  markAsRead(_messageId: string): Promise<boolean>;
  getBusinessProfile(): Promise<{ about: string; address: string; description: string; email: string; vertical: string; website: string } | null>;
}

export interface WhatsAppProviderConfig {
  provider: "meta" | "twilio" | "none";
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  verifyToken?: string;
  webhookSecret?: string;
  webhookUrl?: string;
}

export const WHATSAPP_PROVIDERS = ["meta", "twilio", "none"] as const;
export type WhatsAppProviderType = typeof WHATSAPP_PROVIDERS[number];