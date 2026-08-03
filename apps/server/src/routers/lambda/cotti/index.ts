import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';
import { cottiAgentAccessRouter } from './agentAccess';
import { cottiHomeNotificationRouter } from './homeNotification';
import { cottiModelDisplayRouter } from './modelDisplay';

export const cottiRouter = router({
  admin: cottiAdminRouter,
  agentAccess: cottiAgentAccessRouter,
  homeNotification: cottiHomeNotificationRouter,
  modelDisplay: cottiModelDisplayRouter,
});
