// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BriefModel } from '@/database/models/brief';
import { TaskModel } from '@/database/models/task';
import { TaskTopicModel } from '@/database/models/taskTopic';

import { runHeartbeatTick } from './heartbeatTick';
import { TaskRunnerService } from './index';

const { mockSelectTask, mockSetTaskSchedulerExecutionCallback } = vi.hoisted(() => ({
  mockSelectTask: vi.fn(),
  mockSetTaskSchedulerExecutionCallback: vi.fn(),
}));

vi.mock('@/database/server', () => ({
  getServerDB: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockSelectTask(),
        }),
      }),
    }),
  }),
}));

vi.mock('@/database/models/brief', () => ({
  BriefModel: vi.fn(),
}));

vi.mock('@/database/models/task', () => ({
  TaskModel: vi.fn(),
}));

vi.mock('@/database/models/taskTopic', () => ({
  TaskTopicModel: vi.fn(),
}));

vi.mock('@/server/services/taskScheduler', () => ({
  setTaskSchedulerExecutionCallback: mockSetTaskSchedulerExecutionCallback,
}));

vi.mock('./index', () => ({
  TaskRunnerService: vi.fn(),
}));

describe('runHeartbeatTick', () => {
  const taskId = 'task-1';
  const userId = 'user-1';

  const mockBriefModel = {
    hasUnresolvedUrgentByTask: vi.fn().mockResolvedValue(false),
  };
  const mockTaskModel = {
    updateContext: vi.fn(),
    updateStatus: vi.fn(),
  };
  const mockTaskTopicModel = {
    countConsecutiveCompletedAutomationRuns: vi.fn().mockResolvedValue(0),
  };
  const mockRunner = {
    runTask: vi.fn(),
  };

  const baseTask = (overrides: Partial<Record<string, unknown>> = {}) => ({
    automationMode: 'heartbeat',
    heartbeatInterval: 30,
    id: taskId,
    identifier: 'T-1',
    status: 'scheduled',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectTask.mockResolvedValue([]);
    mockBriefModel.hasUnresolvedUrgentByTask.mockResolvedValue(false);
    mockTaskTopicModel.countConsecutiveCompletedAutomationRuns.mockResolvedValue(0);
    (BriefModel as any).mockImplementation(() => mockBriefModel);
    (TaskModel as any).mockImplementation(() => mockTaskModel);
    (TaskTopicModel as any).mockImplementation(() => mockTaskTopicModel);
    (TaskRunnerService as any).mockImplementation(() => mockRunner);
  });

  it('pauses before the next heartbeat after three consecutive results go unviewed', async () => {
    mockSelectTask.mockResolvedValue([baseTask({ context: {} })]);
    mockTaskTopicModel.countConsecutiveCompletedAutomationRuns.mockResolvedValue(3);

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: false, reason: 'unviewed-results' });
    expect(mockTaskModel.updateStatus).toHaveBeenCalledWith(taskId, 'paused', { error: null });
    expect(mockRunner.runTask).not.toHaveBeenCalled();
  });

  it('skips an already paused heartbeat task without evaluating results', async () => {
    mockSelectTask.mockResolvedValue([baseTask({ status: 'paused' })]);

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: false, reason: 'paused' });
    expect(mockTaskTopicModel.countConsecutiveCompletedAutomationRuns).not.toHaveBeenCalled();
  });

  it('runs the task and excludes transient error briefs from tick gating', async () => {
    mockSelectTask.mockResolvedValue([baseTask()]);
    mockRunner.runTask.mockResolvedValue(undefined);

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: true, taskIdentifier: 'T-1' });
    expect(mockBriefModel.hasUnresolvedUrgentByTask).toHaveBeenCalledWith(taskId, {
      excludeTypes: ['error'],
    });
    expect(mockRunner.runTask).toHaveBeenCalledWith({ taskId, trigger: 'heartbeat' });
  });

  it('still skips when a non-error urgent brief requires human input', async () => {
    mockSelectTask.mockResolvedValue([baseTask()]);
    mockBriefModel.hasUnresolvedUrgentByTask.mockResolvedValue(true);

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: false, reason: 'human-waiting' });
    expect(mockBriefModel.hasUnresolvedUrgentByTask).toHaveBeenCalledWith(taskId, {
      excludeTypes: ['error'],
    });
    expect(mockRunner.runTask).not.toHaveBeenCalled();
  });

  it('skips a stale tick whose generation token no longer matches', async () => {
    mockSelectTask.mockResolvedValue([
      baseTask({ context: { scheduler: { tickToken: 'tick-current' } } }),
    ]);

    const outcome = await runHeartbeatTick(taskId, userId, 'tick-old');

    expect(outcome).toEqual({ ran: false, reason: 'stale-tick' });
    expect(mockRunner.runTask).not.toHaveBeenCalled();
  });

  it('allows legacy tokenless ticks when no active generation is stored', async () => {
    mockSelectTask.mockResolvedValue([baseTask({ context: {} })]);
    mockRunner.runTask.mockResolvedValue(undefined);

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: true, taskIdentifier: 'T-1' });
  });

  it('returns in-flight when runTask raises a CONFLICT', async () => {
    mockSelectTask.mockResolvedValue([baseTask()]);
    mockRunner.runTask.mockRejectedValue(new TRPCError({ code: 'CONFLICT', message: 'busy' }));

    const outcome = await runHeartbeatTick(taskId, userId);

    expect(outcome).toEqual({ ran: false, reason: 'in-flight' });
  });
});
