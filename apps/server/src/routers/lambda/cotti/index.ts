import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';
import { cottiHomeNotificationRouter } from './homeNotification';

export const cottiRouter = router({
  admin: cottiAdminRouter,
  homeNotification: cottiHomeNotificationRouter,
});
