import type { LobeChatDatabase } from '@/database/type';
import type {
  CottiPlatformAnalyticsDashboard,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

import { getCottiPlatformAnalyticsOverview } from './overview';
import { resolveCottiPlatformAnalyticsPeriod } from './range';
import { getCottiPlatformAnalyticsTrends } from './trends';

export class CottiPlatformAnalyticsService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
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
