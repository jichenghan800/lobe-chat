import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';
import { cottiHomeNotificationRouter } from './homeNotification';
import { cottiModelDisplayRouter } from './modelDisplay';
import { cottiPeopleManagementRouter } from './peopleManagement';
import { cottiPlatformAnalyticsRouter } from './platformAnalytics';
import { cottiPlatformAuditRouter } from './platformAudit';
import { cottiTopicBudgetRouter } from './topicBudget';
import { cottiTopicOverviewRouter } from './topicOverview';
import { cottiUsersRouter } from './users';

export const cottiRouter = router({
  admin: cottiAdminRouter,
  users: cottiUsersRouter,
  topicBudget: cottiTopicBudgetRouter,
  homeNotification: cottiHomeNotificationRouter,
  platformAudit: cottiPlatformAuditRouter,
  topicOverview: cottiTopicOverviewRouter,
  platformAnalytics: cottiPlatformAnalyticsRouter,
  modelDisplay: cottiModelDisplayRouter,
  peopleManagement: cottiPeopleManagementRouter,
});
