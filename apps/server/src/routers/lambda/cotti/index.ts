import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';
import { cottiAgentAccessRouter } from './agentAccess';
import { cottiHomeNotificationRouter } from './homeNotification';
import { cottiModelDisplayRouter } from './modelDisplay';
import { cottiPeopleManagementRouter } from './peopleManagement';
import { cottiPlatformAnalyticsRouter } from './platformAnalytics';
import { cottiPlatformAuditRouter } from './platformAudit';

export const cottiRouter = router({
  admin: cottiAdminRouter,
  agentAccess: cottiAgentAccessRouter,
  homeNotification: cottiHomeNotificationRouter,
  modelDisplay: cottiModelDisplayRouter,
  platformAnalytics: cottiPlatformAnalyticsRouter,
  platformAudit: cottiPlatformAuditRouter,
  peopleManagement: cottiPeopleManagementRouter,
});
