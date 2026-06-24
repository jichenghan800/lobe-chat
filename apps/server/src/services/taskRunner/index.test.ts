// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentModel } from '@/database/models/agent';
import { BriefModel } from '@/database/models/brief';
import { TaskModel } from '@/database/models/task';
import { TaskTopicModel } from '@/database/models/taskTopic';
import type { LobeChatDatabase } from '@/database/type';
import { AiAgentService } from '@/server/services/aiAgent';

import { buildTaskPrompt } from './buildTaskPrompt';
import { TaskRunnerService } from './index';

const {
  mockAddTaskTopic,
  mockBuildTaskPrompt,
  mockExecAgent,
  mockFindTaskTopics,
  mockGetCheckpointConfig,
  mockGetReviewConfig,
  mockIncrementTopicCount,
  mockResolveTask,
  mockTaskLifecycleOnTopicComplete,
  mockUpdateCurrentTopic,
  mockUpdateHeartbeat,
  mockUpdateStatus,
} = vi.hoisted(() => ({
  mockAddTaskTopic: vi.fn(),
  mockBuildTaskPrompt: vi.fn(),
  mockExecAgent: vi.fn(),
  mockFindTaskTopics: vi.fn(),
  mockGetCheckpointConfig: vi.fn(),
  mockGetReviewConfig: vi.fn(),
  mockIncrementTopicCount: vi.fn(),
  mockResolveTask: vi.fn(),
  mockTaskLifecycleOnTopicComplete: vi.fn(),
  mockUpdateCurrentTopic: vi.fn(),
  mockUpdateHeartbeat: vi.fn(),
  mockUpdateStatus: vi.fn(),
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn(),
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

vi.mock('@/server/services/aiAgent', () => ({
  AiAgentService: vi.fn(),
}));

vi.mock('@/server/services/taskLifecycle', () => ({
  TaskLifecycleService: vi.fn().mockImplementation(() => ({
    onTopicComplete: mockTaskLifecycleOnTopicComplete,
  })),
}));

vi.mock('./buildTaskPrompt', () => ({
  buildTaskPrompt: mockBuildTaskPrompt,
}));

describe('TaskRunnerService', () => {
  const db = {} as LobeChatDatabase;
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();

    (AgentModel as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getAgentModelConfig: vi.fn(),
    }));
    (BriefModel as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({}));
    (TaskModel as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getCheckpointConfig: mockGetCheckpointConfig,
      getReviewConfig: mockGetReviewConfig,
      incrementTopicCount: mockIncrementTopicCount,
      resolve: mockResolveTask,
      update: vi.fn(),
      updateCurrentTopic: mockUpdateCurrentTopic,
      updateHeartbeat: mockUpdateHeartbeat,
      updateStatus: mockUpdateStatus,
      updateTaskConfig: vi.fn(),
    }));
    (TaskTopicModel as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      add: mockAddTaskTopic,
      findByTaskId: mockFindTaskTopics,
      timeoutRunning: vi.fn(),
      updateOperationId: vi.fn(),
      updateStatus: vi.fn(),
    }));
    (AiAgentService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      execAgent: mockExecAgent,
    }));

    mockResolveTask.mockResolvedValue({
      assigneeAgentId: 'agt_1',
      config: { model: 'gpt-4', provider: 'openai' },
      error: null,
      heartbeatTimeout: null,
      id: 'task_1',
      identifier: 'T-1',
      instruction: 'Run task',
      lastHeartbeatAt: null,
      name: 'Task One',
      status: 'paused',
      totalTopics: 0,
    });
    mockFindTaskTopics.mockResolvedValue([]);
    mockBuildTaskPrompt.mockResolvedValue({ fileIds: [], prompt: 'task prompt' });
    mockGetCheckpointConfig.mockReturnValue({});
    mockGetReviewConfig.mockReturnValue(undefined);
    mockExecAgent.mockResolvedValue({
      autoStarted: true,
      messageId: 'msg_1',
      operationId: 'op_1',
      success: true,
      topicId: 'tpc_1',
    });
  });

  it('passes task identity so execAgent can isolate inherited agent documents', async () => {
    const service = new TaskRunnerService(db, userId);

    await service.runTask({ taskId: 'T-1' });

    expect(buildTaskPrompt).toHaveBeenCalled();
    expect(mockExecAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agt_1',
        prompt: 'task prompt',
        taskId: 'task_1',
      }),
    );
  });
});
