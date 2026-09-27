declare const BRAND: unique symbol;

export type Brand<T, B extends string> = T & { readonly [BRAND]?: B };

export type Uid = Brand<string, "Uid">;
export type LeadId = Brand<string, "LeadId">;
export type ContactId = Brand<string, "ContactId">;
export type EmailId = Brand<string, "EmailId">;
export type WhatsAppMessageId = Brand<string, "WhatsAppMessageId">;
export type CallId = Brand<string, "CallId">;
export type QuoteId = Brand<string, "QuoteId">;
export type BookingId = Brand<string, "BookingId">;
export type WebsiteEventId = Brand<string, "WebsiteEventId">;
export type AIConversationId = Brand<string, "AIConversationId">;
export type AIActionId = Brand<string, "AIActionId">;
export type FollowupId = Brand<string, "FollowupId">;
export type CampaignId = Brand<string, "CampaignId">;
export type SettingsId = Brand<string, "SettingsId">;
export type AuditLogId = Brand<string, "AuditLogId">;
export type SuppressionId = Brand<string, "SuppressionId">;
export type BudgetId = Brand<string, "BudgetId">;
export type TebogoAvailabilityRuleId = Brand<string, "TebogoAvailabilityRuleId">;
export type ProtectedPricingId = Brand<string, "ProtectedPricingId">;
export type InteractionId = Brand<string, "InteractionId">;
export type AIQueueId = Brand<string, "AIQueueId">;
export type FileAssetId = Brand<string, "FileAssetId">;

export type UserRole = "admin" | "client" | "staff" | "agent";

export type UserProfile = {
  uid: Uid | string;
  email: string | null;
  displayName?: string | null;
  company?: string | null;
  phone?: string | null;
  role?: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "REPLIED"
  | "QUALIFIED"
  | "HOT"
  | "QUOTE_SENT"
  | "NEGOTIATING"
  | "WON"
  | "LOST"
  | "FOLLOW_UP";

export type LeadTemperature = "COLD" | "WARM" | "HOT";

export type LeadTemperatureScore = number;

export type LeadSource =
  | "WEBSITE_CONTACT"
  | "WEBSITE_QUOTE"
  | "WEBSITE_REGISTRATION"
  | "WEBSITE_APP_REQUEST"
  | "WEBSITE_BOOKING"
  | "EMAIL_OUTREACH"
  | "WHATSAPP_OUTREACH"
  | "CALL_OUTREACH"
  | "REFERRAL"
  | "MANUAL"
  | "OTHER";

export type ServiceInterest =
  | "WEBSITE"
  | "WEB_APP"
  | "MOBILE_APP"
  | "SEO"
  | "BOOKING_SYSTEM"
  | "CRM_DASHBOARD"
  | "ECOMMERCE"
  | "CUSTOM";

export type BudgetRange =
  | "UNDER_10K"
  | "RANGE_10K_30K"
  | "RANGE_30K_60K"
  | "RANGE_60K_100K"
  | "RANGE_100K_PLUS"
  | "UNKNOWN";

export type Timeline =
  | "URGENT"
  | "WITHIN_1_MONTH"
  | "WITHIN_3_MONTHS"
  | "WITHIN_6_MONTHS"
  | "EXPLORING"
  | "UNKNOWN";

export type Lead = {
  id: LeadId;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  emailNormalized: string | null;
  phoneE164: string | null;
  whatsAppE164: string | null;
  whatsappE164: string | null;
  website: string | null;
  linkedin: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  service: ServiceInterest | null;
  servicesInterested: ServiceInterest[];
  budgetRange: BudgetRange | null;
  timeline: Timeline | null;
  source: LeadSource;
  sourceCampaign: string | null;
  sourceDetail: string | null;
  sourceUrl: string | null;
  status: LeadStatus;
  temperature: LeadTemperatureScore;
  assignedUid: Uid | null;
  assignedToUid: Uid | null;
  aiSummary: string | null;
  notes: string | null;
  score: number;
  lastContactAt: number | null;
  nextAction: string | null;
  nextActionAt: number | null;
  tags: string[];
  gdprOptIn: boolean;
  gdprOptInAt: number | null;
  marketingUnsubscribed: boolean;
  marketingUnsubscribedAt: number | null;
  unsubscribeNonce: string | null;
  convertedAt: number | null;
  customerProfileId: Uid | string | null;
  customFields: Record<string, string | number | boolean | null>;
  createdAt: number;
  updatedAt: number;
  _searchTerms: string[];
};

export type LeadPatch = Omit<Partial<Lead>, "id" | "_searchTerms" | "createdAt"> & {
  id?: never;
};

export type TimelineEventType =
  | "website_event"
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "email_replied"
  | "email_failed"
  | "whatsapp_sent"
  | "whatsapp_received"
  | "call_started"
  | "call_completed"
  | "call_missed"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "quote_won"
  | "quote_lost"
  | "booking_created"
  | "booking_confirmed"
  | "booking_completed"
  | "booking_cancelled"
  | "followup_scheduled"
  | "followup_sent"
  | "followup_cancelled"
  | "ai_summary"
  | "ai_action"
  | "ai_handoff"
  | "status_change"
  | "note_added"
  | "manual";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  at: number;
  summary: string;
  icon: string;
  detail: Record<string, unknown> | null;
  refIds: {
    websiteEventId?: WebsiteEventId;
    emailId?: EmailId;
    whatsappId?: WhatsAppMessageId;
    callId?: CallId;
    quoteId?: QuoteId;
    bookingId?: BookingId;
    followupId?: FollowupId;
    aiConversationId?: string;
    aiActionId?: AIActionId;
  };
  actorUid: Uid | "SYSTEM" | "AI" | null;
  leadId: LeadId;
};

export type InteractionRef =
  | { type: "WEBSITE_EVENT"; refId: WebsiteEventId }
  | { type: "EMAIL"; refId: EmailId }
  | { type: "WHATSAPP"; refId: WhatsAppMessageId }
  | { type: "CALL"; refId: CallId }
  | { type: "QUOTE"; refId: QuoteId }
  | { type: "BOOKING"; refId: BookingId }
  | { type: "FOLLOWUP"; refId: FollowupId }
  | { type: "AI_ACTION"; refId: AIActionId }
  | { type: "NOTE"; refId: null }
  | { type: "STATUS_CHANGE"; refId: null };

export type LeadInteraction = {
  id: InteractionId;
  leadId: LeadId;
  ref: InteractionRef;
  summary: string;
  icon: string;
  by:
    | { kind: "AI" }
    | { kind: "HUMAN"; uid: Uid | null }
    | { kind: "CUSTOMER" }
    | { kind: "SYSTEM" };
  detailMarkdown: string | null;
  createdAt: number;
  data: Record<string, unknown>;
};

export type EmailStatus =
  | "DRAFT"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "OPENED"
  | "CLICKED"
  | "REPLIED"
  | "FAILED"
  | "BOUNCE_SOFT"
  | "BOUNCE_HARD"
  | "UNSUBSCRIBED"
  | "COMPLAINT";

export type EmailEvent = {
  id: string;
  status: EmailStatus;
  at: number;
  detail: string | null;
};

export type EmailDoc = {
  id: EmailId;
  leadId: LeadId | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  html: string | null;
  text: string | null;
  provider: string;
  providerMessageId: string | null;
  replyToEmail: string | null;
  status: EmailStatus;
  events: EmailEvent[];
  openedAt: number | null;
  clickedAt: number | null;
  replyAt: number | null;
  attachments: Array<{ assetId: FileAssetId; filename: string }>;
  suppressUnsubscribeLink: boolean;
  unsubscribeToken: string | null;
  sentAt: number | null;
  createdBy: Uid | "AI" | null;
  createdAt: number;
  updatedAt: number;
};

export type WhatsAppDirection = "INBOUND" | "OUTBOUND";

export type WhatsAppMessage = {
  id: WhatsAppMessageId;
  leadId: LeadId;
  direction: WhatsAppDirection;
  fromE164: string;
  toE164: string;
  body: string;
  provider: string;
  providerMessageId: string | null;
  status:
    | "PENDING"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "RECEIVED";
  attachments: Array<{ assetId: FileAssetId; filename: string }>;
  replyToProviderId: string | null;
  conversationId: AIConversationId | null;
  createdAt: number;
  updatedAt: number;
};

export type CallDirection = "INBOUND" | "OUTBOUND";

export type CallOutcome =
  | "ANSWERED"
  | "MISSED"
  | "NO_ANSWER"
  | "BUSY"
  | "FAILED"
  | "CANCELLED"
  | "HANGUP_BEFORE_CONNECT";

export type CallTranscriptChunk = {
  role: "AGENT" | "CUSTOMER" | "SYSTEM";
  text: string;
  at: number;
  durationMs: number | null;
  final: boolean;
};

export type CallDoc = {
  id: CallId;
  leadId: LeadId | null;
  direction: CallDirection;
  fromE164: string;
  toE164: string;
  provider: string;
  providerCallId: string | null;
  status: "QUEUED" | "RINGING" | "CONNECTED" | "ENDED" | "FAILED";
  outcome: CallOutcome | null;
  durationSeconds: number | null;
  answeredAt: number | null;
  endedAt: number | null;
  humanHandoff:
    | null
    | {
        requested: boolean;
        triedConference: boolean;
        tebogoAnswered: boolean;
        bookedBookingId: BookingId | null;
        handoffReason: string | null;
      };
  tebogoJoinedAt: number | null;
  recordingAssetId: FileAssetId | null;
  transcript: CallTranscriptChunk[];
  summary: string | null;
  aiMood: LeadTemperature | null;
  interested: boolean | null;
  service: ServiceInterest | null;
  budgetRange: BudgetRange | null;
  timeline: Timeline | null;
  recordings: string[];
  createdAt: number;
  updatedAt: number;
};

export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "NEGOTIATING"
  | "REJECTED"
  | "WON"
  | "LOST"
  | "EXPIRED";

export type QuoteLineItem = {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unitRangeLowCents: number;
  unitRangeHighCents: number;
  currency: "ZAR" | "USD";
};

export type Quote = {
  id: QuoteId;
  leadId: LeadId;
  status: QuoteStatus;
  title: string;
  notes: string | null;
  terms: string | null;
  currency: "ZAR" | "USD";
  rangeLowCents: number;
  rangeHighCents: number;
  exactTotalCents: number | null;
  shareTokenNonce: string | null;
  validUntil: number | null;
  items: QuoteLineItem[];
  createdBy: Uid | "AI" | null;
  viewedAt: number | null;
  sentAt: number | null;
  acceptedAt: number | null;
  wonAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type BookingType = "CALLBACK" | "VIDEO" | "IN_PERSON";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED_BY_CUSTOMER"
  | "CANCELLED_BY_STAFF"
  | "NO_SHOW"
  | "COMPLETED";

export type BookingAttendee = {
  name: string;
  email: string | null;
  phoneE164: string | null;
  kind: "CUSTOMER" | "TEBOGO" | "OTHER";
};

export type Booking = {
  id: BookingId;
  leadId: LeadId | null;
  type: BookingType;
  status: BookingStatus;
  title: string;
  startAt: number;
  durationMinutes: number;
  timezoneIana: string | null;
  attendees: BookingAttendee[];
  videoMeetingUrl: string | null;
  phoneCallNumber: string | null;
  location: string | null;
  notes: string | null;
  source: "WEBSITE_PUBLIC" | "LEAD_AI" | "STAFF_MANUAL" | "CALL_HANDOFF";
  createdBy: Uid | "AI" | "CUSTOMER" | null;
  iCalUid: string | null;
  cancelledReason: string | null;
  noShowReason: string | null;
  completedNotes: string | null;
  createdAt: number;
  updatedAt: number;
};

export type WebsiteEventType =
  | "PAGE_VIEW"
  | "CONTACT_REQUEST"
  | "QUOTE_REQUEST"
  | "APP_REQUEST"
  | "REGISTRATION"
  | "BOOKING_REQUEST"
  | "SERVICE_CLICK"
  | "ORDER_BUTTON_CLICK"
  | "WALLET_ACTION"
  | "WHATSAPP_CLICK"
  | "PRICING_VIEW";

export type WebsiteEvent = {
  id: WebsiteEventId;
  type: WebsiteEventType;
  sessionId: string | null;
  visitorId: string | null;
  userId: Uid | null;
  leadId: LeadId | null;
  idempotencyKey: string | null;
  url: string | null;
  referrer: string | null;
  ip: string | null;
  userAgent: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
};

export type AIParticipant =
  | { kind: "AI" }
  | { kind: "HUMAN"; uid: Uid | null }
  | { kind: "CUSTOMER" };

export type AIChatMessage = {
  id: string;
  participant: AIParticipant;
  role: "system" | "assistant" | "user" | "tool";
  content: string | null;
  toolCallId: string | null;
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  createdAt: number;
};

export type AIConversation = {
  id: AIConversationId;
  leadId: LeadId | null;
  channel: "EMAIL" | "WHATSAPP" | "CALL" | "DASHBOARD" | "WEBSITE_CHAT";
  refId: EmailId | WhatsAppMessageId | CallId | null;
  trigger: string | null;
  handoffRequested: boolean;
  handoffBookingId: BookingId | null;
  summary: string | null;
  messages: AIChatMessage[];
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
  humanTurns: number;
  customerTurns: number;
  status: "ACTIVE" | "PAUSED" | "HUMAN_HANDOFF" | "ENDED";
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AIAction = {
  id: AIActionId;
  conversationId: AIConversationId;
  leadId: LeadId | null;
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  ok: boolean;
  deniedByMiddlewareCode: string | null;
  estimatedDollarCost: number | null;
  actualDollarCost: number | null;
  turnIndex: number;
  auditLogId: AuditLogId | null;
  createdAt: number;
};

export type FollowupStatus =
  | "PENDING"
  | "SCHEDULED"
  | "EXECUTING"
  | "COMPLETED"
  | "SKIPPED_REPLY_RECEIVED"
  | "CANCELLED_EMERGENCY_STOP"
  | "CANCELLED_MANUAL"
  | "FAILED";

export type FollowupChannel = "EMAIL" | "WHATSAPP" | "CALL";

export type Followup = {
  id: FollowupId;
  leadId: LeadId;
  campaignId: CampaignId | null;
  channel: FollowupChannel;
  sequenceIndex: number;
  scheduledAt: number;
  executedAt: number | null;
  status: FollowupStatus;
  templateName: string | null;
  subject: string | null;
  body: string | null;
  reasonSkipped: string | null;
  refId: EmailId | WhatsAppMessageId | CallId | null;
  createdBy: Uid | "AI" | "CAMPAIGN" | null;
  createdAt: number;
  updatedAt: number;
};

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "CANCELLED"
  | "COMPLETED";

export type Campaign = {
  id: CampaignId;
  name: string;
  segment: string;
  status: CampaignStatus;
  channels: FollowupChannel[];
  maxLeadsPerDay: number | null;
  totalLeads: number;
  contactedLeads: number;
  replies: number;
  interested: number;
  hot: number;
  quotes: number;
  won: number;
  startedAt: number | null;
  endedAt: number | null;
  createdBy: Uid | null;
  createdAt: number;
  updatedAt: number;
};

export type SystemMode = "AI" | "HUMAN" | "PAUSED";

export type SystemSettings = {
  id: SettingsId;
  systemMode: SystemMode;
  emergencyStop: boolean;
  emergencyStopAt: number | null;
  emergencyStopBy: Uid | "SYSTEM" | null;
  emergencyStopReason: string | null;
  tebogoDefaultPhoneE164: string | null;
  defaultTimezoneIana: string;
  dailyEmailMax: number;
  dailyWhatsAppMax: number;
  dailyCallMinutesMax: number;
  businessHoursUtc: Array<{ day: number; openUtcMin: number; closeUtcMin: number }>;
  businessName: string;
  businessEmail: string | null;
  businessPhoneE164: string | null;
  aiDefaultModel: string | null;
  aiDisclosurePolicy:
    | "IMMEDIATE"
    | "AFTER_INTRO"
    | "ON_QUESTION"
    | "CUSTOMER_ASKED_FIRST";
  videoMeetingPlatform: "JITSI" | "CUSTOM";
  videoMeetingBaseUrl: string | null;
  updatedAt: number;
  updatedBy: Uid | "SYSTEM" | null;
};

export type AuditEvent =
  | "LEAD_CREATE"
  | "LEAD_UPDATE"
  | "EMAIL_SEND"
  | "EMAIL_REPLY_RECEIVED"
  | "WHATSAPP_SEND"
  | "WHATSAPP_RECEIVE"
  | "CALL_INITIATE"
  | "CALL_END"
  | "CALL_HANDOFF"
  | "QUOTE_CREATE"
  | "QUOTE_STATUS_CHANGE"
  | "BOOKING_CREATE"
  | "BOOKING_STATUS_CHANGE"
  | "AI_TOOL_CALL"
  | "AI_CONVERSATION_END"
  | "BUDGET_EXCEEDED"
  | "MODE_CHANGE"
  | "EMERGENCY_STOP"
  | "EMERGENCY_RESUME"
  | "SETTINGS_UPDATE"
  | "SUPPRESSION_ADD"
  | "SUPPRESSION_REMOVE"
  | "CAMPAIGN_START"
  | "CAMPAIGN_STOP"
  | "FOLLOWUP_SCHEDULE"
  | "FOLLOWUP_EXECUTE"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT";

export type AuditLog = {
  id: AuditLogId;
  actorUid: Uid | "AI" | "SYSTEM" | "CUSTOMER" | null;
  ip: string | null;
  userAgent: string | null;
  event: AuditEvent;
  detail: string | null;
  leadId: LeadId | null;
  emailId: EmailId | null;
  callId: CallId | null;
  quoteId: QuoteId | null;
  bookingId: BookingId | null;
  aiConversationId: AIConversationId | null;
  aiActionId: AIActionId | null;
  aiQueueId: AIQueueId | null;
  data: Record<string, unknown>;
  createdAt: number;
};

export type SuppressionReason =
  | "UNSUBSCRIBE"
  | "BOUNCE_HARD"
  | "COMPLAINT"
  | "OPT_OUT_MANUAL"
  | "LEAD_REQUESTED"
  | "GLOBAL_BLACKLIST";

export type Suppression = {
  id: SuppressionId;
  email: string | null;
  phoneE164: string | null;
  channel: "EMAIL" | "WHATSAPP" | "CALL" | "ALL";
  reason: SuppressionReason;
  leadId: LeadId | null;
  sourceEventId: AuditLogId | null;
  note: string | null;
  suppressedAt: number;
  createdAt: number;
};

export type BudgetChannel = "AI" | "EMAIL" | "VOICE" | "WHATSAPP" | "TOTAL_OUTREACH";

export type Budget = {
  id: BudgetId;
  channel: BudgetChannel;
  limitDollars: number;
  usedDollars: number;
  usedTokens: number | null;
  usedMinutes: number | null;
  usedMessages: number | null;
  stopAtBudget: boolean;
  periodStart: number;
  periodEnd: number;
  updatedAt: number;
};

export type TebogoAvailabilityRule = {
  id: TebogoAvailabilityRuleId;
  enabled: boolean;
  dayOfWeek: number;
  startUtcMin: number;
  endUtcMin: number;
  timezoneIana: string;
  note: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ProtectedPricing = {
  id: ProtectedPricingId;
  service: ServiceInterest | "CUSTOM";
  slug: string;
  label: string;
  currency: "ZAR" | "USD";
  publicRangeLowCents: number;
  publicRangeHighCents: number;
  internalLowCents: number | null;
  internalHighCents: number | null;
  defaultTimelineDaysLow: number | null;
  defaultTimelineDaysHigh: number | null;
  description: string | null;
  updatedAt: number;
};

export type AIQueueStatus =
  | "PENDING"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED_EMERGENCY_STOP"
  | "CANCELLED_BUDGET";

export type AIQueueItem = {
  id: AIQueueId;
  leadId: LeadId | null;
  conversationId: AIConversationId | null;
  trigger: string;
  idempotencyKey: string | null;
  status: AIQueueStatus;
  retryCount: number;
  nextRunAt: number | null;
  lastError: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type BudgetDailyCounter = {
  channel: BudgetChannel;
  dateKey: string;
  usedDollars: number;
  usedMessages: number;
  usedMinutes: number;
};

export type AnalyticsRollupKey =
  | "emails_sent_30d"
  | "emails_replied_30d"
  | "calls_made_30d"
  | "calls_answered_30d"
  | "whatsapp_sent_30d"
  | "whatsapp_replied_30d"
  | "leads_new_30d"
  | "leads_hot_30d"
  | "leads_qualified_30d"
  | "quotes_created_30d"
  | "quotes_won_30d"
  | "bookings_created_30d"
  | "ai_conversations_active"
  | "ai_followups_scheduled"
  | "revenue_won_30d_cents";

export type AnalyticsRollup = {
  id: string;
  key: AnalyticsRollupKey | string;
  asOf: number;
  value: number;
  currency?: "ZAR" | "USD";
};

export type OptimusMemoryCategory =
  | "preferences"
  | "goals"
  | "projects"
  | "decisions"
  | "knowledge"
  | "plans"
  | "lessons"
  | "routines";

export type OptimusMemory = {
  id: string;
  userId: Uid;
  category: OptimusMemoryCategory;
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OptimusGoal = {
  id: string;
  userId: Uid;
  title: string;
  description: string;
  horizon: "today" | "week" | "month" | "quarter" | "half_year" | "year" | "long_term";
  status: "active" | "paused" | "completed" | "cancelled";
  targetDate?: number;
  metrics?: Record<string, number>;
  parentGoalId?: string;
  projectIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type OptimusProject = {
  id: string;
  userId: Uid;
  name: string;
  description: string;
  goalIds: string[];
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  startDate?: number;
  targetEndDate?: number;
  actualEndDate?: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type OptimusMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  targetDate: number;
  completedAt?: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
};

export type OptimusTask = {
  id: string;
  userId: Uid;
  projectId?: string;
  milestoneId?: string;
  goalId?: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  dueDate?: number;
  scheduledDate?: number;
  completedAt?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  tags: string[];
  dependencies: string[];
  recurrence?: RecurrenceRule;
  createdAt: number;
  updatedAt: number;
};

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: number;
  occurrences?: number;
};

export type OptimusSchedule = {
  id: string;
  userId: Uid;
  name: string;
  description: string;
  timezoneIana: string;
  workingHours: WorkingHoursRule[];
  studyHours: StudyHoursRule[];
  projectTimeBlocks: ProjectTimeBlock[];
  createdAt: number;
  updatedAt: number;
};

export type WorkingHoursRule = {
  dayOfWeek: number;
  startUtcMin: number;
  endUtcMin: number;
  label?: string;
};

export type StudyHoursRule = {
  dayOfWeek: number;
  startUtcMin: number;
  endUtcMin: number;
  label?: string;
};

export type ProjectTimeBlock = {
  projectId: string;
  dayOfWeek: number;
  startUtcMin: number;
  endUtcMin: number;
  label?: string;
};

export type OptimusReminder = {
  id: string;
  userId: Uid;
  title: string;
  description?: string;
  dueAt: number;
  recurrence?: RecurrenceRule;
  status: "pending" | "triggered" | "completed" | "cancelled" | "snoozed";
  relatedEntityType?: "task" | "lead" | "project" | "goal" | "milestone";
  relatedEntityId?: string;
  notificationChannels: ("dashboard" | "email" | "push")[];
  createdAt: number;
  updatedAt: number;
};

export type OptimusDecision = {
  id: string;
  userId: Uid;
  title: string;
  description: string;
  context: string;
  decision: string;
  reasoning: string;
  alternativesConsidered: string[];
  rejectedOptions: string[];
  tags: string[];
  relatedGoalIds: string[];
  relatedProjectIds: string[];
  createdAt: number;
};

export type OptimusLesson = {
  id: string;
  userId: Uid;
  triggerAction: string;
  actionType: string;
  context: Record<string, unknown>;
  result: Record<string, unknown>;
  metrics: Record<string, number>;
  whatWorked: string[];
  whatDidntWork: string[];
  lesson: string;
  confidence: number;
  tags: string[];
  appliesTo: string[];
  createdAt: number;
};

export type OptimusPlan = {
  id: string;
  userId: Uid;
  goalId: string;
  title: string;
  description: string;
  horizon: OptimusGoal["horizon"];
  milestones: OptimusMilestone[];
  tasks: OptimusTask[];
  dependencies: Array<{ from: string; to: string; type: "blocks" | "relates" }>;
  status: "draft" | "active" | "paused" | "completed";
  createdAt: number;
  updatedAt: number;
};

export type OptimusActionAuthorization = {
  action: string;
  category: "READ" | "LOW_RISK_WRITE" | "EXTERNAL_COMMUNICATION" | "FINANCIAL_HIGH_IMPACT";
  requiresApproval: boolean;
  autoExecuteIfPreApproved: boolean;
  preApprovedContexts?: string[];
};

export type OptimusConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  createdAt: number;
};

export type OptimusConversation = {
  id: string;
  userId: Uid;
  messages: OptimusConversationMessage[];
  activePlanId?: string;
  activeProjectId?: string;
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OptimusActivityLogEntry = {
  id: string;
  userId: Uid;
  type: "conversation" | "decision" | "plan_created" | "task_created" | "reminder_created" | "tool_called" | "action_executed" | "action_awaiting_approval" | "error" | "learning_event";
  timestamp: number;
  summary: string;
  detail?: Record<string, unknown>;
  conversationId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
};

export interface ScheduledAutomation {
  id: string;
  userId: Uid;
  name: string;
  description: string;
  trigger: "cron" | "interval" | "date";
  cronExpression?: string;
  intervalMs?: number;
  runAt?: number;
  action: {
    type: "run_optimus_turn" | "send_report" | "run_research" | "run_custom";
    payload: Record<string, unknown>;
  };
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type VoiceProvider = "elevenlabs" | "openai" | "azure" | "google" | "custom";

export type STTProvider = "openai-whisper" | "azure" | "google" | "deepgram" | "custom";

export type TTSProvider = "elevenlabs" | "openai" | "azure" | "google" | "custom";

export interface STTAdapter {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<{ text: string; confidence?: number; language?: string }>;
  getSupportedFormats(): string[];
}

export interface TTSAdapter {
  synthesize(text: string, voiceId?: string): Promise<{ audioBuffer: Buffer; mimeType: string; durationMs?: number }>;
  getAvailableVoices(): Promise<Array<{ id: string; name: string; language: string; gender?: string }>>;
}

export interface VoiceProviderAdapter {
  stt: STTAdapter;
  tts: TTSAdapter;
  name: string;
}
