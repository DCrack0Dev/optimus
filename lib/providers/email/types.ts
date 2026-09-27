export interface EmailSendInput {
  toEmail: string;
  toName?: string | null;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  replyToEmail?: string | null;
  unsubscribeToken?: string | null;
  leadId?: string | null;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string | null;
  error?: string | null;
}

export interface EmailProvider {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export interface EmailWebhookEvent {
  type: "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounce" | "complaint" | "unsubscribed" | "error" | "invalid";
  emailId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}