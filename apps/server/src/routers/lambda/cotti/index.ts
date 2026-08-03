import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';
import { cottiHomeNotificationRouter } from './homeNotification';
import { cottiModelDisplayRouter } from './modelDisplay';

export const cottiRouter = router({
  admin: cottiAdminRouter,
  homeNotification: cottiHomeNotificationRouter,
  modelDisplay: cottiModelDisplayRouter,
});
