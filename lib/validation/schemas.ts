import { z } from "zod";

export const E164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{4,14}$/, "Expected E.164 phone like +27830001234");

export const EmailAddress = z.string().trim().email();
export const WebUrl = z.string().trim().url().or(z.literal(""));

export const UserRoleSchema = z.enum(["admin", "client", "staff", "agent"]);

export const LeadStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "HOT",
  "QUOTE_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "FOLLOW_UP"
]);

export const SortDirectionSchema = z.enum(["asc", "desc"]);

export const LeadTemperatureSchema = z.enum(["COLD", "WARM", "HOT"]);

export const LeadSourceSchema = z.enum([
  "WEBSITE_CONTACT",
  "WEBSITE_QUOTE",
  "WEBSITE_REGISTRATION",
  "WEBSITE_APP_REQUEST",
  "WEBSITE_BOOKING",
  "EMAIL_OUTREACH",
  "WHATSAPP_OUTREACH",
  "CALL_OUTREACH",
  "REFERRAL",
  "MANUAL",
  "OTHER"
]);

export const ServiceInterestSchema = z.enum([
  "WEBSITE",
  "WEB_APP",
  "MOBILE_APP",
  "SEO",
  "BOOKING_SYSTEM",
  "CRM_DASHBOARD",
  "ECOMMERCE",
  "CUSTOM"
]);

export const BudgetRangeSchema = z.enum([
  "UNDER_10K",
  "RANGE_10K_30K",
  "RANGE_30K_60K",
  "RANGE_60K_100K",
  "RANGE_100K_PLUS",
  "UNKNOWN"
]);

export const TimelineSchema = z.enum([
  "URGENT",
  "WITHIN_1_MONTH",
  "WITHIN_3_MONTHS",
  "WITHIN_6_MONTHS",
  "EXPLORING",
  "UNKNOWN"
]);

const ID_STRING = z.string().min(1).max(128);
const NULLABLE_STRING = z.string().max(1024).nullable().or(z.literal(""));
const NULLABLE_TEXT = z.string().max(20_000).nullable().or(z.literal(""));

export const LeadSchema = z.object({
  id: ID_STRING.optional(),
  firstName: z.string().max(200).nullable().or(z.literal("")).optional(),
  lastName: z.string().max(200).nullable().or(z.literal("")).optional(),
  fullName: z.string().max(400).nullable().or(z.literal("")).optional(),
  name: z.string().max(200).nullable().or(z.literal("")).optional(),
  company: z.string().max(200).nullable().or(z.literal("")).optional(),
  title: z.string().max(200).nullable().or(z.literal("")).optional(),
  email: EmailAddress.nullable().or(z.literal("")).optional(),
  emailNormalized: z.string().max(320).nullable().or(z.literal("")).optional(),
  phoneE164: E164.nullable().or(z.literal("")).optional(),
  whatsappE164: E164.nullable().or(z.literal("")).optional(),
  website: WebUrl.nullable().or(z.literal("")).optional(),
  linkedin: WebUrl.nullable().or(z.literal("")).optional(),
  address: z.string().max(500).nullable().or(z.literal("")).optional(),
  city: z.string().max(200).nullable().or(z.literal("")).optional(),
  region: z.string().max(200).nullable().or(z.literal("")).optional(),
  countryCode: z.string().max(8).nullable().or(z.literal("")).optional(),
  service: ServiceInterestSchema.nullish(),
  servicesInterested: z.array(ServiceInterestSchema).default([]),
  budgetRange: BudgetRangeSchema.nullish(),
  timeline: TimelineSchema.nullish(),
  source: LeadSourceSchema.default("MANUAL"),
  sourceCampaign: z.string().max(200).nullable().or(z.literal("")).optional(),
  sourceDetail: z.string().max(500).nullable().or(z.literal("")).optional(),
  sourceUrl: WebUrl.nullable().or(z.literal("")).optional(),
  status: LeadStatusSchema.default("NEW"),
  temperature: z.number().int().min(0).max(100).default(25),
  assignedUid: ID_STRING.nullish(),
  assignedToUid: ID_STRING.nullish(),
  aiSummary: NULLABLE_TEXT.nullish(),
  notes: NULLABLE_TEXT.nullish(),
  score: z.number().int().min(0).max(100).default(0),
  lastContactAt: z.number().int().nullable().nullish(),
  nextAction: NULLABLE_STRING.nullish(),
  nextActionAt: z.number().int().nullable().nullish(),
  tags: z.array(z.string().max(64)).default([]),
  gdprOptIn: z.boolean().default(false),
  gdprOptInAt: z.number().int().nullable().nullish(),
  marketingUnsubscribed: z.boolean().default(false),
  marketingUnsubscribedAt: z.number().int().nullable().nullish(),
  unsubscribeNonce: z.string().max(128).nullable().or(z.literal("")).optional(),
  convertedAt: z.number().int().nullable().nullish(),
  customerProfileId: ID_STRING.nullish(),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export const LeadPatchSchema = LeadSchema.partial().strict();

export const WebsiteEventTypeSchema = z.enum([
  "PAGE_VIEW",
  "CONTACT_REQUEST",
  "QUOTE_REQUEST",
  "APP_REQUEST",
  "REGISTRATION",
  "BOOKING_REQUEST",
  "SERVICE_CLICK",
  "ORDER_BUTTON_CLICK",
  "WALLET_ACTION",
  "WHATSAPP_CLICK",
  "PRICING_VIEW"
]);

export const WebsiteEventSchema = z.object({
  type: WebsiteEventTypeSchema,
  sessionId: z.string().max(128).nullable().or(z.literal("")).optional(),
  visitorId: z.string().max(128).nullable().or(z.literal("")).optional(),
  userId: ID_STRING.nullable().or(z.literal("")).optional(),
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  idempotencyKey: z.string().max(128).min(1),
  url: WebUrl.optional(),
  referrer: WebUrl.optional(),
  userAgent: z.string().max(1024).optional(),
  payload: z.record(z.unknown()).default({})
});

export const BudgetChannelSchema = z.enum([
  "AI",
  "EMAIL",
  "VOICE",
  "WHATSAPP",
  "TOTAL_OUTREACH"
]);

export const BudgetSchema = z.object({
  id: ID_STRING.optional(),
  channel: BudgetChannelSchema,
  limitDollars: z.number().min(0).max(1_000_000),
  usedDollars: z.number().min(0).default(0),
  usedTokens: z.number().int().nullable().nullish(),
  usedMinutes: z.number().nullable().nullish(),
  usedMessages: z.number().int().nullable().nullish(),
  stopAtBudget: z.boolean().default(true),
  periodStart: z.number().int(),
  periodEnd: z.number().int()
});

export const SystemModeSchema = z.enum(["AI", "HUMAN", "PAUSED"]);

export const SystemSettingsSchema = z.object({
  id: ID_STRING.optional(),
  systemMode: SystemModeSchema.default("AI"),
  emergencyStop: z.boolean().default(false),
  emergencyStopAt: z.number().int().nullable().nullish(),
  emergencyStopBy: z.union([ID_STRING, z.literal("SYSTEM")]).nullable().nullish(),
  emergencyStopReason: NULLABLE_TEXT.nullish(),
  tebogoDefaultPhoneE164: E164.nullable().or(z.literal("")).optional(),
  defaultTimezoneIana: z.string().max(64).default("Africa/Johannesburg"),
  dailyEmailMax: z.number().int().min(0).default(300),
  dailyWhatsAppMax: z.number().int().min(0).default(100),
  dailyCallMinutesMax: z.number().int().min(0).default(120),
  businessHoursUtc: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        openUtcMin: z.number().int().min(0).max(1439),
        closeUtcMin: z.number().int().min(0).max(1439)
      })
    )
    .default([]),
  businessName: z.string().max(120).default("DemiTech Web Services"),
  businessEmail: EmailAddress.nullable().or(z.literal("")).optional(),
  businessPhoneE164: E164.nullable().or(z.literal("")).optional(),
  aiDefaultModel: NULLABLE_STRING.nullish(),
  aiDisclosurePolicy: z
    .enum(["IMMEDIATE", "AFTER_INTRO", "ON_QUESTION", "CUSTOMER_ASKED_FIRST"])
    .default("AFTER_INTRO"),
  videoMeetingPlatform: z.enum(["JITSI", "CUSTOM"]).default("JITSI"),
  videoMeetingBaseUrl: WebUrl.nullish()
});

export const ProtectedPricingSchema = z.object({
  id: ID_STRING.optional(),
  service: ServiceInterestSchema.or(z.literal("CUSTOM")),
  slug: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  currency: z.enum(["ZAR", "USD"]).default("ZAR"),
  publicRangeLowCents: z.number().int().min(0),
  publicRangeHighCents: z.number().int().min(0),
  internalLowCents: z.number().int().nullable().nullish(),
  internalHighCents: z.number().int().nullable().nullish(),
  defaultTimelineDaysLow: z.number().int().nullable().nullish(),
  defaultTimelineDaysHigh: z.number().int().nullable().nullish(),
  description: NULLABLE_TEXT.nullish()
});

export const SuppressionReasonSchema = z.enum([
  "UNSUBSCRIBE",
  "BOUNCE_HARD",
  "COMPLAINT",
  "OPT_OUT_MANUAL",
  "LEAD_REQUESTED",
  "GLOBAL_BLACKLIST"
]);

export const SuppressionSchema = z.object({
  id: ID_STRING.optional(),
  email: EmailAddress.nullable().or(z.literal("")),
  phoneE164: E164.nullable().or(z.literal("")),
  channel: z.enum(["EMAIL", "WHATSAPP", "CALL", "ALL"]).default("ALL"),
  reason: SuppressionReasonSchema,
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  note: NULLABLE_TEXT.nullish()
});

export const AuditEventSchema = z.enum([
  "LEAD_CREATE",
  "LEAD_UPDATE",
  "EMAIL_SEND",
  "EMAIL_REPLY_RECEIVED",
  "WHATSAPP_SEND",
  "WHATSAPP_RECEIVE",
  "CALL_INITIATE",
  "CALL_END",
  "CALL_HANDOFF",
  "QUOTE_CREATE",
  "QUOTE_STATUS_CHANGE",
  "BOOKING_CREATE",
  "BOOKING_STATUS_CHANGE",
  "AI_TOOL_CALL",
  "AI_CONVERSATION_END",
  "BUDGET_EXCEEDED",
  "MODE_CHANGE",
  "EMERGENCY_STOP",
  "EMERGENCY_RESUME",
  "SETTINGS_UPDATE",
  "SUPPRESSION_ADD",
  "SUPPRESSION_REMOVE",
  "CAMPAIGN_START",
  "CAMPAIGN_STOP",
  "FOLLOWUP_SCHEDULE",
  "FOLLOWUP_EXECUTE",
  "AUTH_LOGIN",
  "AUTH_LOGOUT"
]);

export const AuditLogSchema = z.object({
  id: ID_STRING.optional(),
  actorUid: z
    .union([ID_STRING, z.enum(["AI", "SYSTEM", "CUSTOMER"])])
    .nullable()
    .nullish(),
  ip: z.string().max(64).nullable().nullish(),
  userAgent: z.string().max(1024).nullable().nullish(),
  event: AuditEventSchema,
  detail: NULLABLE_TEXT.nullish(),
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  emailId: ID_STRING.nullable().or(z.literal("")).optional(),
  callId: ID_STRING.nullable().or(z.literal("")).optional(),
  quoteId: ID_STRING.nullable().or(z.literal("")).optional(),
  bookingId: ID_STRING.nullable().or(z.literal("")).optional(),
  aiConversationId: ID_STRING.nullable().or(z.literal("")).optional(),
  aiActionId: ID_STRING.nullable().or(z.literal("")).optional(),
  data: z.record(z.unknown()).default({})
});

export const QuoteLineItemSchema = z.object({
  id: ID_STRING,
  label: z.string().min(1).max(200),
  description: NULLABLE_STRING.nullish(),
  quantity: z.number().int().min(1).default(1),
  unitRangeLowCents: z.number().int().min(0),
  unitRangeHighCents: z.number().int().min(0),
  currency: z.enum(["ZAR", "USD"]).default("ZAR")
});

export const QuoteStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "NEGOTIATING",
  "REJECTED",
  "WON",
  "LOST",
  "EXPIRED"
]);

export const QuoteSchema = z.object({
  id: ID_STRING.optional(),
  leadId: ID_STRING,
  status: QuoteStatusSchema.default("DRAFT"),
  title: z.string().min(1).max(200),
  notes: NULLABLE_TEXT.nullish(),
  terms: NULLABLE_TEXT.nullish(),
  currency: z.enum(["ZAR", "USD"]).default("ZAR"),
  rangeLowCents: z.number().int().min(0),
  rangeHighCents: z.number().int().min(0),
  exactTotalCents: z.number().int().nullable().nullish(),
  shareTokenNonce: NULLABLE_STRING.nullish(),
  validUntil: z.number().int().nullable().nullish(),
  items: z.array(QuoteLineItemSchema).default([]),
  createdBy: z.union([ID_STRING, z.literal("AI")]).nullable().nullish(),
  viewedAt: z.number().int().nullable().nullish(),
  sentAt: z.number().int().nullable().nullish(),
  acceptedAt: z.number().int().nullable().nullish(),
  wonAt: z.number().int().nullable().nullish()
});

export const BookingTypeSchema = z.enum(["CALLBACK", "VIDEO", "IN_PERSON"]);
export const BookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_STAFF",
  "NO_SHOW",
  "COMPLETED"
]);
export const BookingSourceSchema = z.enum([
  "WEBSITE_PUBLIC",
  "LEAD_AI",
  "STAFF_MANUAL",
  "CALL_HANDOFF"
]);

export const BookingAttendeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: EmailAddress.nullable().or(z.literal("")).optional(),
  phoneE164: E164.nullable().or(z.literal("")).optional(),
  kind: z.enum(["CUSTOMER", "TEBOGO", "OTHER"]).default("CUSTOMER")
});

export const BookingSchema = z.object({
  id: ID_STRING.optional(),
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  type: BookingTypeSchema,
  status: BookingStatusSchema.default("PENDING"),
  title: z.string().min(1).max(240),
  startAt: z.number().int(),
  durationMinutes: z.number().int().min(15).max(480),
  timezoneIana: z.string().max(64).nullable().or(z.literal("")).optional(),
  attendees: z.array(BookingAttendeeSchema).min(1),
  videoMeetingUrl: WebUrl.nullable().or(z.literal("")).optional(),
  phoneCallNumber: E164.nullable().or(z.literal("")).optional(),
  location: z.string().max(240).nullable().or(z.literal("")).optional(),
  notes: NULLABLE_TEXT.nullish(),
  source: BookingSourceSchema.default("WEBSITE_PUBLIC"),
  createdBy: z
    .union([ID_STRING, z.literal("AI"), z.literal("CUSTOMER")])
    .nullable()
    .nullish(),
  cancelledReason: NULLABLE_TEXT.nullish(),
  noShowReason: NULLABLE_TEXT.nullish(),
  completedNotes: NULLABLE_TEXT.nullish()
});

export const BookingPublicSubmitSchema = BookingSchema.pick({
  type: true,
  title: true,
  startAt: true,
  durationMinutes: true,
  timezoneIana: true,
  attendees: true,
  notes: true
}).merge(
  z.object({
    source: BookingSourceSchema.default("WEBSITE_PUBLIC"),
    service: ServiceInterestSchema.optional(),
    leadName: z.string().max(200).optional(),
    leadEmail: EmailAddress.optional(),
    leadPhoneE164: E164.optional()
  })
);

export const EmailSendSchema = z.object({
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  toEmail: EmailAddress,
  toName: z.string().max(200).nullable().or(z.literal("")).optional(),
  subject: z.string().min(1).max(300),
  html: z.string().max(500_000).nullable().or(z.literal("")).optional(),
  text: z.string().max(500_000).nullable().or(z.literal("")).optional(),
  templateId: z.string().max(120).nullable().or(z.literal("")).optional(),
  templateVariables: z.record(z.unknown()).default({})
});

export const CallInitiateSchema = z.object({
  leadId: ID_STRING.nullable().or(z.literal("")).optional(),
  toE164: E164,
  contextPurpose: z.string().max(400).nullable().or(z.literal("")).optional()
});

export const WhatsAppSendSchema = z.object({
  leadId: ID_STRING,
  body: z.string().min(1).max(4000),
  templateName: z.string().max(120).nullable().or(z.literal("")).optional()
});

export const FollowupStatusSchema = z.enum([
  "PENDING",
  "SCHEDULED",
  "EXECUTING",
  "COMPLETED",
  "SKIPPED_REPLY_RECEIVED",
  "CANCELLED_EMERGENCY_STOP",
  "CANCELLED_MANUAL",
  "FAILED"
]);

export const FollowupChannelSchema = z.enum(["EMAIL", "WHATSAPP", "CALL"]);

export const FollowupCreateSchema = z.object({
  leadId: ID_STRING,
  channel: FollowupChannelSchema,
  sequenceIndex: z.number().int().min(0).default(0),
  scheduledAt: z.number().int(),
  templateName: z.string().max(120).nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  body: z.string().max(10000),
  campaignId: ID_STRING.nullable().optional(),
  createdBy: z.union([ID_STRING, z.literal("AI"), z.literal("CAMPAIGN")]).nullable().optional(),
});

export const FollowupUpdateSchema = z.object({
  followupId: ID_STRING,
  status: FollowupStatusSchema.optional(),
  executedAt: z.number().int().nullable().optional(),
  refId: ID_STRING.nullable().optional(),
  reasonSkipped: z.string().max(500).nullable().optional(),
}).strict();
