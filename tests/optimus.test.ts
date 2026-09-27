// tests/optimus.test.ts
import { runOptimusTurn } from '@/lib/ai/optimus/brain';
import { createOptimusGoal, getOptimusGoals, updateOptimusGoal, deleteOptimusGoal } from '@/lib/ai/optimus/brain';
import { createOptimusTask, getOptimusTasks, updateOptimusTask, completeOptimusTask } from '@/lib/ai/optimus/brain';
import { createOptimusReminder, getOptimusReminders } from '@/lib/ai/optimus/brain';
import { createOptimusDecision, getOptimusDecisions } from '@/lib/ai/optimus/brain';
import { createOptimusLesson, getOptimusLessons } from '@/lib/ai/optimus/brain';
import { logOptimusActivity, getOptimusActivityLog } from '@/lib/ai/optimus/brain';

describe('Optimus - Conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs a simple conversation turn', async () => {
    const result = await runOptimusTurn({
      userId: 'test-uid',
      initialMessage: 'What happened today?',
      maxTurns: 2,
    });

    expect(result).toHaveProperty('reply');
    expect(result).toHaveProperty('conversationId');
    expect(typeof result.reply).toBe('string');
    expect(result.conversationId).toMatch(/^optimus_conv_\d+_[a-z0-9]+$/);
  });

  it('creates new conversation for each call without conversationId', async () => {
    const firstTurn = await runOptimusTurn({
      userId: 'test-uid',
      initialMessage: 'Hello Optimus',
      maxTurns: 1,
    });

    const secondTurn = await runOptimusTurn({
      userId: 'test-uid',
      initialMessage: 'What can you do?',
      maxTurns: 1,
    });

    // Each call without conversationId creates a new conversation
    expect(firstTurn.conversationId).toMatch(/^optimus_conv_\d+_[a-z0-9]+$/);
    expect(secondTurn.conversationId).toMatch(/^optimus_conv_\d+_[a-z0-9]+$/);
    // Different conversations created for each call without conversationId
    expect(firstTurn.conversationId).not.toBe(secondTurn.conversationId);
  });
});

describe('Optimus - Goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a goal', async () => {
    const goal = await createOptimusGoal('test-uid', {
      title: 'Grow revenue',
      description: 'Increase monthly revenue by 20%',
      horizon: 'quarter',
      targetDate: Date.now() + 90 * 86400000,
      metrics: { targetRevenue: 100000 },
    });

    expect(goal.id).toBeDefined();
    expect(goal.title).toBe('Grow revenue');
    expect(goal.status).toBe('active');
    expect(goal.projectIds).toEqual([]);
  });

  it('lists goals', async () => {
    const goals = await getOptimusGoals('test-uid');
    expect(Array.isArray(goals)).toBe(true);
  });

  it('updates goal status', async () => {
    const goal = await createOptimusGoal('test-uid', {
      title: 'Test goal',
      description: 'Test description',
      horizon: 'month',
    });

    const updated = await updateOptimusGoal('test-uid', goal.id, {
      status: 'completed',
    });

    expect(updated).toBeDefined();
    if (updated) {
      expect(updated.status).toBe('completed');
    }
  });

  it('deletes goal', async () => {
    const goal = await createOptimusGoal('test-uid', {
      title: 'To be deleted',
      description: 'Test',
      horizon: 'week',
    });

    await deleteOptimusGoal('test-uid', goal.id);
    // Deletion is fire-and-forget, verify no error thrown
  });
});

describe('Optimus - Tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a task', async () => {
    const task = await createOptimusTask('test-uid', {
      title: 'Write blog post',
      description: 'Write about AI trends',
      priority: 'high',
      dueDate: Date.now() + 7 * 86400000,
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Write blog post');
    expect(task.status).toBe('backlog');
    expect(task.priority).toBe('high');
    expect(task.tags).toEqual([]);
    expect(task.dependencies).toEqual([]);
  });

  it('completes a task', async () => {
    const task = await createOptimusTask('test-uid', {
      title: 'Test task',
      description: 'Test',
    });

    const completed = await completeOptimusTask('test-uid', task.id);
    expect(completed).toBeDefined();
    if (completed) {
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
    }
  });

  it('lists tasks', async () => {
    const tasks = await getOptimusTasks('test-uid');
    expect(Array.isArray(tasks)).toBe(true);
  });
});

describe('Optimus - Reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a reminder', async () => {
    const reminder = await createOptimusReminder('test-uid', {
      title: 'Review quarterly report',
      dueAt: Date.now() + 86400000,
    });

    expect(reminder.id).toBeDefined();
    expect(reminder.title).toBe('Review quarterly report');
    expect(reminder.status).toBe('pending');
    expect(reminder.notificationChannels).toEqual(['dashboard']);
  });

  it('lists reminders', async () => {
    const reminders = await getOptimusReminders('test-uid');
    expect(Array.isArray(reminders)).toBe(true);
  });
});

describe('Optimus - Decisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a decision', async () => {
    const decision = await createOptimusDecision('test-uid', {
      title: 'Switch to new CRM',
      description: 'Evaluated options and chose HubSpot',
      context: 'Current CRM lacks features',
      decision: 'Migrate to HubSpot',
      reasoning: 'Better integration with existing tools',
      alternativesConsidered: ['Salesforce', 'Pipedrive'],
      rejectedOptions: ['Salesforce - too expensive', 'Pipedrive - limited features'],
      tags: ['crm', 'migration'],
    });

    expect(decision.id).toBeDefined();
    expect(decision.title).toBe('Switch to new CRM');
  });

  it('lists decisions', async () => {
    const decisions = await getOptimusDecisions('test-uid');
    expect(Array.isArray(decisions)).toBe(true);
  });
});

describe('Optimus - Lessons (Learning)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a lesson from action outcome', async () => {
    const lesson = await createOptimusLesson('test-uid', {
      triggerAction: 'sent_cold_email',
      actionType: 'outreach',
      context: { channel: 'EMAIL', template: 'cold_v1' },
      result: { responseRate: 0.02, meetingsBooked: 1 },
      whatWorked: ['personalized subject line'],
      whatDidntWork: ['generic body text'],
      lesson: 'Personalize subject lines for better open rates',
      confidence: 0.8,
      tags: ['email', 'outreach'],
    });

    expect(lesson.id).toBeDefined();
    expect(lesson.lesson).toContain('Personalize');
  });

  it('lists lessons', async () => {
    const lessons = await getOptimusLessons('test-uid');
    expect(Array.isArray(lessons)).toBe(true);
  });
});

describe('Optimus - Activity Log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs activity', async () => {
    await logOptimusActivity({
      userId: 'test-uid',
      type: 'task_created',
      summary: 'Created task: Write blog post',
      detail: { taskId: 'task-123' },
      relatedEntityType: 'task',
      relatedEntityId: 'task-123',
    });

    // Verify no error thrown
  });

  it('retrieves activity log', async () => {
    const log = await getOptimusActivityLog('test-uid', 10);
    expect(Array.isArray(log)).toBe(true);
  });
});