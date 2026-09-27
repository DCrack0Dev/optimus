export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "getLead",
      description: "Get full lead details by ID",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "Lead ID" },
        },
        required: ["leadId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listLeads",
      description: "List leads with filters",
      parameters: {
        type: "object",
        properties: {
          status: { type: "array", items: { type: "string" }, description: "Lead statuses" },
          source: { type: "string", description: "Lead source" },
          service: { type: "string", description: "Service interest" },
          q: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createLead",
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
          budgetRange: { type: "string" },
          timeline: { type: "string" },
        },
        required: ["source"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "updateLead",
      description: "Update lead fields",
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
      name: "sendEmail",
      description: "Send an email to a lead",
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
      name: "sendWhatsApp",
      description: "Send a WhatsApp message to a lead",
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
  {
    type: "function" as const,
    function: {
      name: "scheduleFollowup",
      description: "Schedule a follow-up for a lead",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          when: { type: "number", description: "Unix timestamp" },
          task: { type: "string" },
          channel: { type: "string", enum: ["EMAIL", "WHATSAPP", "CALL"] },
        },
        required: ["leadId", "when", "task", "channel"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createQuote",
      description: "Create a DRAFT quote for a lead",
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
      name: "logActivity",
      description: "Log an AI activity note on the lead timeline",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          type: { type: "string" },
          text: { type: "string" },
        },
        required: ["leadId", "type", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getConversation",
      description: "Get AI conversation by ID",
      parameters: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
        },
        required: ["conversationId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggestPriceRange",
      description: "Get public price range for a service (never exact prices)",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string" },
          brief: { type: "string" },
        },
        required: ["service", "brief"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getTebogoAvailability",
      description: "Check Tebogo's availability in a time window",
      parameters: {
        type: "object",
        properties: {
          windowStart: { type: "number", description: "Unix timestamp" },
          windowEnd: { type: "number", description: "Unix timestamp" },
        },
        required: ["windowStart", "windowEnd"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createBooking",
      description: "Create a booking (callback, video, or in-person)",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          type: { type: "string", enum: ["CALLBACK", "VIDEO", "IN_PERSON"] },
          startsAt: { type: "number", description: "Unix timestamp" },
          durationMin: { type: "number" },
          mediumUrl: { type: "string" },
          notes: { type: "string" },
        },
        required: ["leadId", "type", "startsAt", "durationMin"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "attemptTebogoHandoff",
      description: "Check if Tebogo is available for handoff and get suggestion",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          callId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["leadId", "reason"],
        additionalProperties: false,
      },
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]["function"]["name"];