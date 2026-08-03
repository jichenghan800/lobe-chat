import type { LobeChatDatabase } from '@/database/type';
import type {
  CottiPlatformAnalyticsChatUsers,
  CottiPlatformAnalyticsChatUsersQuery,
  CottiPlatformAnalyticsDashboard,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

import { getCottiPlatformAnalyticsChatUsers } from './chatUsers';
import { getCottiPlatformAnalyticsOverview } from './overview';
import { resolveCottiPlatformAnalyticsPeriod } from './range';
import { getCottiPlatformAnalyticsTrends } from './trends';

export class CottiPlatformAnalyticsService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async getChatUsers(
    query?: CottiPlatformAnalyticsChatUsersQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsChatUsers> {
    const period = resolveCottiPlatformAnalyticsPeriod(query?.range, now);
    const result = await getCottiPlatformAnalyticsChatUsers(this.db, period, query);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
  }

  async getDashboard(
    query?: CottiPlatformAnalyticsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsDashboard> {
    const period = resolveCottiPlatformAnalyticsPeriod(query, now);
    const [overview, trends] = await Promise.all([
      getCottiPlatformAnalyticsOverview(this.db, period),
      getCottiPlatformAnalyticsTrends(this.db, period),
    ]);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      overview,
      period: publicPeriod,
      trends,
    };
  }
}
