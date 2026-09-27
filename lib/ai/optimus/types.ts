import type { Uid } from "@shared/types";

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
  category: OptimusMemoryCategory;
  key: string;
  value: unknown;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OptimusGoal = {
  id: string;
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
  name: string;
  description: string;
  goalIds: string[];
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  ownerUid: Uid;
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

export type OptimusPreference = {
  key: string;
  value: unknown;
  category: "working_hours" | "communication_style" | "priorities" | "recurring_commitments" | "other";
  description?: string;
  updatedAt: number;
};

export type OptimusPlan = {
  id: string;
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

export const OPTIMUS_ACTION_AUTHORIZATIONS: OptimusActionAuthorization[] = [
  { action: "read_business_knowledge", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_website_information", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_leads", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_contacts", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_conversations", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_emails", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_calls", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_quotes", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_bookings", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "read_analytics", category: "READ", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_lead", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_lead", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_quote", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_quote", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_booking", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_booking", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_task", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_task", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "complete_task", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_reminder", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_recurring_reminder", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_schedule", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_schedule", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_goal", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_goal", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_project", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_milestone", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "create_plan", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "update_plan", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "record_decision", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "record_learning", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "send_email", category: "EXTERNAL_COMMUNICATION", requiresApproval: true, autoExecuteIfPreApproved: false, preApprovedContexts: ["draft_reviewed"] },
  { action: "prepare_email", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "send_whatsapp", category: "EXTERNAL_COMMUNICATION", requiresApproval: true, autoExecuteIfPreApproved: false, preApprovedContexts: ["draft_reviewed"] },
  { action: "prepare_whatsapp", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
  { action: "initiate_voice_call", category: "EXTERNAL_COMMUNICATION", requiresApproval: true, autoExecuteIfPreApproved: false },
  { action: "schedule_callback", category: "LOW_RISK_WRITE", requiresApproval: false, autoExecuteIfPreApproved: true },
];

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
  messages: OptimusConversationMessage[];
  activePlanId?: string;
  activeProjectId?: string;
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type OptimusActivityLogEntry = {
  id: string;
  type: "conversation" | "decision" | "plan_created" | "task_created" | "reminder_created" | "tool_called" | "action_executed" | "action_awaiting_approval" | "error" | "learning_event";
  timestamp: number;
  summary: string;
  detail?: Record<string, unknown>;
  conversationId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
};

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