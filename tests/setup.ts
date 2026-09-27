// tests/setup.ts
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_BASE_URL = 'https://api.groq.com/openai/v1';
process.env.LLM_MODEL = 'llama-3.3-70b-versatile';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.BREVO_SENDER_EMAIL = 'test@example.com';
process.env.BREVO_SENDER_NAME = 'Test Sender';
process.env.WEBHOOK_HMAC_SECRET = 'test-hmac-secret';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.TEBOGO_PHONE_E164 = '+27830000000';
process.env.BUSINESS_EMAIL = 'business@example.com';
process.env.BUSINESS_PHONE_E164 = '+27100000000';
process.env.TELNYX_API_KEY = 'test-telnyx-key';
process.env.TELNYX_CONNECTION_ID = 'test-connection-id';
process.env.TELNYX_CALLER_ID = '+27100000000';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
    create: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    runTransaction: jest.fn(async (fn) => fn({
      get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
  getAdminAuth: jest.fn(() => ({
    createSessionCookie: jest.fn().mockResolvedValue('test-cookie'),
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-uid', admin: true }),
    verifySessionCookie: jest.fn().mockResolvedValue({ uid: 'test-uid', admin: true }),
  })),
  isAdminConfigured: jest.fn(() => true),
  getAdminApp: jest.fn(),
  getAdminStorage: jest.fn(),
}));

// Mock audit writer
jest.mock('@/lib/audit/writer', () => ({
  writeAudit: jest.fn().mockResolvedValue({ ok: true, refId: 'test-audit-id' }),
}));

// Mock budget engine
const budgetUsage = {
  AI: 0,
  EMAIL: 0,
  VOICE: 0,
  WHATSAPP: 0,
  TOTAL_OUTREACH: 0,
};

const budgetLimits = {
  AI: 10,
  EMAIL: 0,
  VOICE: 5,
  WHATSAPP: 5,
  TOTAL_OUTREACH: 25,
};

jest.mock('@/lib/budgets/engine', () => ({
  getBudget: jest.fn(async (channel: string) => ({
    channel,
    limitDollars: budgetLimits[channel as keyof typeof budgetLimits] ?? 0,
    usedDollars: budgetUsage[channel as keyof typeof budgetUsage] ?? 0,
    usedTokens: null,
    usedMinutes: null,
    usedMessages: null,
    stopAtBudget: true,
    periodStart: Date.now(),
    periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  })),
  incrementAndCheck: jest.fn(async (
    actor: { uid: string; role?: string | null },
    channel: string,
    dollars: number,
    opts?: any
  ) => {
    const currentUsage = budgetUsage[channel as keyof typeof budgetUsage] ?? 0;
    const limit = budgetLimits[channel as keyof typeof budgetLimits] ?? 0;
    const newUsage = currentUsage + dollars;
    
    budgetUsage[channel as keyof typeof budgetUsage] = newUsage;
    
    // Also track total outreach
    if (channel !== 'TOTAL_OUTREACH' && channel !== 'AI') {
      budgetUsage.TOTAL_OUTREACH = (budgetUsage.TOTAL_OUTREACH ?? 0) + dollars;
    }
    
    const allowed = limit === 0 || newUsage <= limit;
    
    return {
      ok: true,
      allowed,
      denyReason: allowed ? undefined : 'budget_exceeded',
      usedDollars: newUsage,
      limitDollars: limit,
      remainingDollars: Math.max(0, limit - newUsage),
    };
  }),
  setBudgetLimit: jest.fn(),
  _resetBudgetUsage: () => {
    Object.keys(budgetUsage).forEach(k => { budgetUsage[k as keyof typeof budgetUsage] = 0; });
  },
  _setBudgetLimit: (channel: string, limit: number) => {
    budgetLimits[channel as keyof typeof budgetLimits] = limit;
  },
  _getBudgetUsage: () => ({ ...budgetUsage }),
  _getBudgetLimits: () => ({ ...budgetLimits }),
}));

// Mock middleware with configurable behavior
const middlewareState = {
  emergencyStop: false,
};

jest.mock('@/lib/tools/middleware', () => {
  return {
    toolMiddleware: jest.fn(async (input: any) => {
      // Check emergency stop
      if (middlewareState.emergencyStop && input.outbound) {
        return {
          ok: true,
          allowed: false,
          denyReason: 'All outbound communications paused (emergency stop).',
          denyCode: 'emergency_stop',
          auditRef: 'test-audit',
          budgetChecks: [],
        };
      }
      
      // Check budget for outbound actions
      if (input.outbound && input.estimatedDollars && input.estimatedDollars > 0) {
        const { incrementAndCheck } = await import('@/lib/budgets/engine');
        const budgetResult = await incrementAndCheck(
          { uid: input.actor.uid, role: input.actor.role },
          input.channel,
          input.estimatedDollars,
          { context: `tool=${input.tool}`, leadId: input.leadId }
        );
        
        if (!budgetResult.allowed) {
          return {
            ok: true,
            allowed: false,
            denyReason: `Budget limit reached for ${input.channel}.`,
            denyCode: 'budget_exceeded',
            auditRef: 'test-audit',
            budgetChecks: [{ channel: input.channel as any, result: budgetResult }],
          };
        }
        
        return {
          ok: true,
          allowed: true,
          auditRef: 'test-audit',
          budgetChecks: [{ channel: input.channel as any, result: budgetResult }],
        };
      }
      
      // Check suppression (simplified)
      if (input.outbound && (input.channel === 'EMAIL' || input.channel === 'WHATSAPP' || input.channel === 'VOICE')) {
        // Simplified - would check suppressions in real implementation
      }
      
      return {
        ok: true,
        allowed: true,
        auditRef: 'test-audit',
        budgetChecks: [],
      };
    }),
    // Export state setter for tests
    _setEmergencyStop: (value: boolean) => { middlewareState.emergencyStop = value; },
    _getEmergencyStop: () => middlewareState.emergencyStop,
  };
});

// Mock audit writer
jest.mock('@/lib/audit/writer', () => ({
  writeAudit: jest.fn().mockResolvedValue({ ok: true, refId: 'test-audit-id' }),
}));

// Mock providers
jest.mock('@/lib/providers', () => ({
  getEmailProvider: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'test-msg-id' }),
  })),
  getLLMProvider: jest.fn(() => ({
    createChatCompletion: jest.fn().mockResolvedValue({
      content: 'Test response',
      toolCalls: null,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
  })),
  getWhatsAppProvider: jest.fn(() => null),
  getVoiceProvider: jest.fn(() => null),
  createSTTProvider: jest.fn(() => ({
    transcribe: jest.fn().mockResolvedValue({ text: 'Test transcript', confidence: 1, language: 'en' }),
  })),
  createTTSProvider: jest.fn(() => ({
    synthesize: jest.fn().mockResolvedValue({ audioBuffer: Buffer.from('test'), mimeType: 'audio/mpeg', voiceUsed: 'test' }),
  })),
}));

// Global test timeout
jest.setTimeout(10000);

// Export test utilities
export { testState, budgetUsage, budgetLimits, middlewareState };