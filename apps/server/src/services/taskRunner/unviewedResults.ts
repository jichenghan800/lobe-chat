import type { TaskItem, TaskLifecycleAudit, TaskSchedulerContext } from '@lobechat/types';
import { TASK_AUTOMATION_UNVIEWED_RESULT_LIMIT } from '@lobechat/types';

import { TaskModel } from '@/database/models/task';
import { TaskTopicModel } from '@/database/models/taskTopic';
import type { LobeChatDatabase } from '@/database/type';

export const AUTOMATION_UNVIEWED_RESULT_PAUSE_REASON = 'unviewed-automation-results-limit-reached';

interface PauseForUnviewedResultsParams {
  db: LobeChatDatabase;
  task: TaskItem;
  userId: string;
  workspaceId?: string;
}

/**
 * Pause an automation task before its next model call when the latest three
 * successful automation results have not been acknowledged by the user.
 */
export const pauseForUnviewedResults = async ({
  db,
  task,
  userId,
  workspaceId,
}: PauseForUnviewedResultsParams): Promise<boolean> => {
  const context =
    (task.context as {
      lifecycle?: TaskLifecycleAudit;
      scheduler?: TaskSchedulerContext;
    } | null) ?? {};
  const acknowledgedAtIso = context.scheduler?.lastResultAcknowledgedAt;
  const acknowledgedAt = acknowledgedAtIso ? new Date(acknowledgedAtIso) : undefined;
  const validAcknowledgedAt =
    acknowledgedAt && !Number.isNaN(acknowledgedAt.getTime()) ? acknowledgedAt : undefined;

  const taskTopicModel = new TaskTopicModel(db, userId, workspaceId);
  const unviewedResultCount = await taskTopicModel.countConsecutiveCompletedAutomationRuns(
    task.id,
    {
      limit: TASK_AUTOMATION_UNVIEWED_RESULT_LIMIT,
      since: validAcknowledgedAt,
    },
  );
  if (unviewedResultCount < TASK_AUTOMATION_UNVIEWED_RESULT_LIMIT) return false;

  const now = new Date().toISOString();
  const taskModel = new TaskModel(db, userId, workspaceId);
  await taskModel.updateContext(task.id, {
    lifecycle: {
      lastPausedAt: now,
      lastPauseReason: AUTOMATION_UNVIEWED_RESULT_PAUSE_REASON,
    },
  });
  await taskModel.updateStatus(task.id, 'paused', { error: null });
  return true;
};
