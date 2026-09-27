import { jest } from '@jest/globals';

(process.env as unknown as Record<string, string>).NODE_ENV = 'test';
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

const resolved = (v: any) => (jest.fn() as any).mockResolvedValue(v);
const returned = (v: any) => (jest.fn() as any).mockReturnValue(v);

jest.mock('@/lib/firebase/admin', () => ({
  getAdminDb: jest.fn(() => ({
    collection: (jest.fn() as any).mockReturnThis(),
    doc: (jest.fn() as any).mockReturnThis(),
    where: (jest.fn() as any).mockReturnThis(),
    orderBy: (jest.fn() as any).mockReturnThis(),
    limit: (jest.fn() as any).mockReturnThis(),
    get: resolved({ docs: [], empty: true, size: 0 }),
    create: resolved(undefined),
    set: resolved(undefined),
    update: resolved(undefined),
    delete: resolved(undefined),
    runTransaction: jest.fn(async (fn: any) => fn({
      get: resolved({ exists: false, data: () => ({}) }),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
  getAdminAuth: jest.fn(() => ({
    createSessionCookie: resolved('test-cookie'),
    verifyIdToken: resolved({ uid: 'test-uid', admin: true }),
    verifySessionCookie: resolved({ uid: 'test-uid', admin: true }),
  })),
  isAdminConfigured: jest.fn(() => true),
  getAdminApp: jest.fn(),
  getAdminStorage: jest.fn(),
}));

jest.mock('@/lib/audit/writer', () => ({
  writeAudit: resolved({ ok: true, refId: 'test-audit-id' }),
}));

const budgetUsage: Record<string, number> = {
  AI: 0, EMAIL: 0, VOICE: 0, WHATSAPP: 0, TOTAL_OUTREACH: 0,
};
const budgetLimits: Record<string, number> = {
  AI: 10, EMAIL: 0, VOICE: 5, WHATSAPP: 5, TOTAL_OUTREACH: 25,
};

jest.mock('@/lib/budgets/engine', () => ({
  getBudget: jest.fn(async (channel: string) => ({
    channel,
    limitDollars: budgetLimits[channel] ?? 0,
    usedDollars: budgetUsage[channel] ?? 0,
    usedTokens: null,
    usedMinutes: null,
    usedMessages: null,
    stopAtBudget: true,
    periodStart: Date.now(),
    periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  })),
  incrementAndCheck: jest.fn(async (
    _actor: { uid: string; role?: string | null },
    channel: string,
    dollars: number,
    _opts?: any
  ) => {
    const currentUsage = budgetUsage[channel] ?? 0;
    const limit = budgetLimits[channel] ?? 0;
    const newUsage = currentUsage + dollars;
    budgetUsage[channel] = newUsage;
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
    Object.keys(budgetUsage).forEach(k => { budgetUsage[k] = 0; });
  },
  _setBudgetLimit: (channel: string, limit: number) => { budgetLimits[channel] = limit; },
  _getBudgetUsage: () => ({ ...budgetUsage }),
  _getBudgetLimits: () => ({ ...budgetLimits }),
}));

const middlewareState = { emergencyStop: false };

jest.mock('@/lib/tools/middleware', () => {
  return {
    toolMiddleware: jest.fn(async (input: any) => {
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
          ok: true, allowed: true,
          auditRef: 'test-audit',
          budgetChecks: [{ channel: input.channel as any, result: budgetResult }],
        };
      }
      return { ok: true, allowed: true, auditRef: 'test-audit', budgetChecks: [] };
    }),
    _setEmergencyStop: (value: boolean) => { middlewareState.emergencyStop = value; },
    _getEmergencyStop: () => middlewareState.emergencyStop,
  };
});

jest.mock('@/lib/providers', () => ({
  getEmailProvider: jest.fn(() => ({
    send: resolved({ success: true, providerMessageId: 'test-msg-id' }),
  })),
  getLLMProvider: jest.fn(() => ({
    createChatCompletion: resolved({
      content: 'Test response', toolCalls: null,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }),
  })),
  getWhatsAppProvider: jest.fn(() => null),
  getVoiceProvider: jest.fn(() => null),
  createSTTProvider: jest.fn(() => ({
    transcribe: resolved({ text: 'Test transcript', confidence: 1, language: 'en' }),
  })),
  createTTSProvider: jest.fn(() => ({
    synthesize: resolved({ audioBuffer: Buffer.from('test'), mimeType: 'audio/mpeg', voiceUsed: 'test' }),
  })),
}));

jest.setTimeout(10000);

export { budgetUsage, budgetLimits, middlewareState };
