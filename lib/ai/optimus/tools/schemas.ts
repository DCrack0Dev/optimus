export const OPTIMUS_TOOL_DEFINITIONS = [
  // Memory tools
  {
    type: "function" as const,
    function: {
      name: "memory_get",
      description: "Retrieve Optimus memory entries by category",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["preferences", "goals", "projects", "decisions", "knowledge", "plans", "lessons", "routines"] },
          key: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_set",
      description: "Store or update an Optimus memory entry",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["preferences", "goals", "projects", "decisions", "knowledge", "plans", "lessons", "routines"] },
          key: { type: "string" },
          value: { type: "object" },
          metadata: { type: "object" },
        },
        required: ["category", "key", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_delete",
      description: "Delete an Optimus memory entry",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Goals
  {
    type: "function" as const,
    function: {
      name: "goals_list",
      description: "List all goals",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "goals_create",
      description: "Create a new goal",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          horizon: { type: "string", enum: ["today", "week", "month", "quarter", "half_year", "year", "long_term"] },
          targetDate: { type: "number" },
          metrics: { type: "object" },
        },
        required: ["title", "description", "horizon"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "goals_update",
      description: "Update a goal",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] },
          targetDate: { type: "number" },
          metrics: { type: "object" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "goals_delete",
      description: "Delete a goal",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Projects
  {
    type: "function" as const,
    function: {
      name: "projects_list",
      description: "List all projects",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "projects_create",
      description: "Create a new project",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          goalIds: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["planning", "active", "on_hold", "completed", "cancelled"] },
          targetEndDate: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "projects_update",
      description: "Update a project",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["planning", "active", "on_hold", "completed", "cancelled"] },
          targetEndDate: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Tasks
  {
    type: "function" as const,
    function: {
      name: "tasks_list",
      description: "List tasks, optionally filtered by project",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done", "cancelled"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tasks_create",
      description: "Create a new task",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          projectId: { type: "string" },
          goalId: { type: "string" },
          milestoneId: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          dueDate: { type: "number" },
          scheduledDate: { type: "number" },
          estimatedMinutes: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
          recurrence: {
            type: "object",
            properties: {
              frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly", "custom"] },
              interval: { type: "number" },
              daysOfWeek: { type: "array", items: { type: "number" } },
              dayOfMonth: { type: "number" },
              endDate: { type: "number" },
              occurrences: { type: "number" },
            },
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tasks_update",
      description: "Update a task",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["backlog", "todo", "in_progress", "review", "done", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          dueDate: { type: "number" },
          scheduledDate: { type: "number" },
          estimatedMinutes: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "tasks_complete",
      description: "Mark a task as completed",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Reminders
  {
    type: "function" as const,
    function: {
      name: "reminders_list",
      description: "List all reminders",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reminders_create",
      description: "Create a new reminder",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          dueAt: { type: "number" },
          recurrence: {
            type: "object",
            properties: {
              frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly", "custom"] },
              interval: { type: "number" },
              daysOfWeek: { type: "array", items: { type: "number" } },
              dayOfMonth: { type: "number" },
              endDate: { type: "number" },
              occurrences: { type: "number" },
            },
          },
          relatedEntityType: { type: "string", enum: ["task", "lead", "project", "goal", "milestone"] },
          relatedEntityId: { type: "string" },
          notificationChannels: { type: "array", items: { type: "string", enum: ["dashboard", "email", "push"] } },
        },
        required: ["title", "dueAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reminders_update",
      description: "Update a reminder",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["pending", "triggered", "completed", "cancelled", "snoozed"] },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Decisions
  {
    type: "function" as const,
    function: {
      name: "decisions_list",
      description: "List all decisions",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "decisions_create",
      description: "Record a decision",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          context: { type: "string" },
          decision: { type: "string" },
          reasoning: { type: "string" },
          alternativesConsidered: { type: "array", items: { type: "string" } },
          rejectedOptions: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          relatedGoalIds: { type: "array", items: { type: "string" } },
          relatedProjectIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "context", "decision", "reasoning"],
        additionalProperties: false,
      },
    },
  },

  // Lessons (Learning)
  {
    type: "function" as const,
    function: {
      name: "lessons_list",
      description: "List all lessons learned",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lessons_create",
      description: "Record a lesson from an action outcome",
      parameters: {
        type: "object",
        properties: {
          triggerAction: { type: "string" },
          actionType: { type: "string" },
          context: { type: "object" },
          result: { type: "object" },
          metrics: { type: "object" },
          whatWorked: { type: "array", items: { type: "string" } },
          whatDidntWork: { type: "array", items: { type: "string" } },
          lesson: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          tags: { type: "array", items: { type: "string" } },
          appliesTo: { type: "array", items: { type: "string" } },
        },
        required: ["triggerAction", "actionType", "context", "result", "lesson"],
        additionalProperties: false,
      },
    },
  },

  // Plans
  {
    type: "function" as const,
    function: {
      name: "plans_list",
      description: "List all plans",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plans_create",
      description: "Create a new plan",
      parameters: {
        type: "object",
        properties: {
          goalId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          horizon: { type: "string", enum: ["today", "week", "month", "quarter", "half_year", "year", "long_term"] },
          milestones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                targetDate: { type: "number" },
                dependencies: { type: "array", items: { type: "string" } },
              },
              required: ["title", "targetDate"],
            },
          },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                dueDate: { type: "number" },
                dependencies: { type: "array", items: { type: "string" } },
              },
              required: ["title"],
            },
          },
          dependencies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                type: { type: "string", enum: ["blocks", "relates"] },
              },
              required: ["from", "to", "type"],
            },
          },
        },
        required: ["goalId", "title", "description", "horizon"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plans_update",
      description: "Update a plan",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["draft", "active", "paused", "completed"] },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },

  // Business Data Access (Read-only for Optimus)
  {
    type: "function" as const,
    function: {
      name: "business_read_leads",
      description: "Read leads from the business CRM",
      parameters: {
        type: "object",
        properties: {
          status: { type: "array", items: { type: "string" } },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_conversations",
      description: "Read AI conversations",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_emails",
      description: "Read sent/received emails",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_calls",
      description: "Read call records",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          outcome: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_quotes",
      description: "Read quotes",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_bookings",
      description: "Read bookings",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_read_analytics",
      description: "Read business analytics summary",
      parameters: {
        type: "object",
        properties: {
          rangeDays: { type: "number", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },

  // Business Write Actions (Low Risk)
  {
    type: "function" as const,
    function: {
      name: "business_create_lead",
      description: "Create a new lead",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          phoneE164: { type: "string", pattern: "^\\+[1-9]\\d{4,14}$" },
          company: { type: "string" },
          source: { type: "string" },
          servicesInterested: { type: "array", items: { type: "string" } },
        },
        required: ["source"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_update_lead",
      description: "Update a lead",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          status: { type: "string" },
          temperature: { type: "number" },
          nextAction: { type: "string" },
          nextActionAt: { type: "number" },
          aiSummary: { type: "string" },
          notes: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["leadId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_create_quote",
      description: "Create a DRAFT quote",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unitRangeLowCents: { type: "number" },
                unitRangeHighCents: { type: "number" },
                currency: { type: "string", enum: ["ZAR", "USD"] },
              },
              required: ["label", "quantity", "unitRangeLowCents", "unitRangeHighCents", "currency"],
            },
          },
          note: { type: "string" },
          rangeLowCents: { type: "number" },
          rangeHighCents: { type: "number" },
          currency: { type: "string", enum: ["ZAR", "USD"] },
        },
        required: ["leadId", "items", "rangeLowCents", "rangeHighCents", "currency"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_create_booking",
      description: "Create a booking (callback, video, or in-person)",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          type: { type: "string", enum: ["CALLBACK", "VIDEO", "IN_PERSON"] },
          startsAt: { type: "number" },
          durationMin: { type: "number" },
          mediumUrl: { type: "string" },
          notes: { type: "string" },
        },
        required: ["leadId", "type", "startsAt", "durationMin"],
        additionalProperties: false,
      },
    },
  },

  // External Communication (Requires Approval)
  {
    type: "function" as const,
    function: {
      name: "business_send_email",
      description: "Send an email (requires approval unless pre-authorized)",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          requiresApproval: { type: "boolean", default: true },
        },
        required: ["leadId", "subject"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_prepare_email",
      description: "Prepare an email draft for review",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
        },
        required: ["leadId", "subject"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_send_whatsapp",
      description: "Send a WhatsApp message (requires approval unless pre-authorized)",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          text: { type: "string" },
          requiresApproval: { type: "boolean", default: true },
        },
        required: ["leadId", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "business_prepare_whatsapp",
      description: "Prepare a WhatsApp draft for review",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          text: { type: "string" },
        },
        required: ["leadId", "text"],
        additionalProperties: false,
      },
    },
  },

  // Scheduling
  {
    type: "function" as const,
    function: {
      name: "schedule_get_availability",
      description: "Check Tebogo availability in a time window",
      parameters: {
        type: "object",
        properties: {
          windowStart: { type: "number" },
          windowEnd: { type: "number" },
        },
        required: ["windowStart", "windowEnd"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_create_booking",
      description: "Create a booking for Tebogo",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          type: { type: "string", enum: ["CALLBACK", "VIDEO", "IN_PERSON"] },
          startsAt: { type: "number" },
          durationMin: { type: "number" },
          notes: { type: "string" },
        },
        required: ["leadId", "type", "startsAt", "durationMin"],
        additionalProperties: false,
      },
    },
  },

  // Research/Prospecting
  {
    type: "function" as const,
    function: {
      name: "research_companies",
      description: "Research companies matching criteria",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          location: { type: "string" },
          industry: { type: "string" },
          count: { type: "number", default: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "research_audit_website",
      description: "Audit a website for DemiTech opportunities",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "research_create_leads_from_prospects",
      description: "Create leads from researched prospects",
      parameters: {
        type: "object",
        properties: {
          prospects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                companyName: { type: "string" },
                website: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
                source: { type: "string" },
                notes: { type: "string" },
              },
              required: ["companyName"],
            },
          },
        },
        required: ["prospects"],
        additionalProperties: false,
      },
    },
  },

  // Activity Log
  {
    type: "function" as const,
    function: {
      name: "activity_log",
      description: "Log an activity entry",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["conversation", "decision", "plan_created", "task_created", "reminder_created", "tool_called", "action_executed", "action_awaiting_approval", "error", "learning_event"] },
          summary: { type: "string" },
          detail: { type: "object" },
          relatedEntityType: { type: "string" },
          relatedEntityId: { type: "string" },
        },
        required: ["type", "summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "activity_get_log",
      description: "Get recent activity log",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 50 },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

export type OptimusToolName = (typeof OPTIMUS_TOOL_DEFINITIONS)[number]["function"]["name"];