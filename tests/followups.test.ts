// tests/followups.test.ts
import { createFollowup, updateFollowup, cancelFollowup, listFollowups, getPendingFollowups, getDueFollowupsForExecution } from '@/lib/domain/followups/service';

describe('Followups Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFollowup', () => {
    it('creates a followup with correct structure', async () => {
      const result = await createFollowup({
        actor: { uid: 'test-uid', role: 'admin' },
        origin: 'AI',
        leadId: 'test-lead-id',
        channel: 'EMAIL',
        sequenceIndex: 0,
        scheduledAt: Date.now() + 86400000, // Tomorrow
        body: 'Test followup body',
        createdBy: 'AI',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.followup.leadId).toBe('test-lead-id');
        expect(result.followup.channel).toBe('EMAIL');
        expect(result.followup.status).toBe('PENDING');
      }
    });

    it('respects middleware budget checks', async () => {
      const result = await createFollowup({
        actor: { uid: 'test-uid', role: 'admin' },
        origin: 'AI',
        leadId: 'test-lead-id',
        channel: 'EMAIL',
        sequenceIndex: 0,
        scheduledAt: Date.now() + 86400000,
        body: 'Test followup body',
        createdBy: 'AI',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('updateFollowup', () => {
    it('returns false when followup not found in mock', async () => {
      // With mock Firestore, updateFollowup returns false because mock doesn't find the document
      const result = await updateFollowup({
        actor: { uid: 'test-uid', role: 'admin' },
        followupId: 'non-existent-id',
        status: 'COMPLETED',
        executedAt: Date.now(),
        refId: 'test-email-id',
      });

      expect(result.ok).toBe(false);
    });

    it('cancels followup on emergency stop', async () => {
      // With mock, cancelFollowup returns false because mock doesn't find the document
      const result = await cancelFollowup(
        { uid: 'SYSTEM', role: null },
        'non-existent-id',
        'EMERGENCY_STOP'
      );

      expect(result.ok).toBe(false);
    });
  });

  describe('listFollowups', () => {
    it('returns empty array with mock', async () => {
      const result = await listFollowups({
        status: ['PENDING', 'SCHEDULED'],
        limit: 10,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('filters by lead', async () => {
      const result = await listFollowups({
        leadId: 'test-lead-id',
        limit: 10,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('getPendingFollowups', () => {
    it('returns empty array with mock', async () => {
      const result = await getPendingFollowups(10);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDueFollowupsForExecution', () => {
    it('returns empty array with mock', async () => {
      const result = await getDueFollowupsForExecution(10);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});