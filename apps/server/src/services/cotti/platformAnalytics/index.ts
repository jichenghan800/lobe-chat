import type { LobeChatDatabase } from '@/database/type';
import type {
  CottiPlatformAnalyticsAgentErrors,
  CottiPlatformAnalyticsAgentErrorsQuery,
  CottiPlatformAnalyticsAgents,
  CottiPlatformAnalyticsAgentsQuery,
  CottiPlatformAnalyticsChatErrors,
  CottiPlatformAnalyticsChatErrorsQuery,
  CottiPlatformAnalyticsChatModels,
  CottiPlatformAnalyticsChatModelsQuery,
  CottiPlatformAnalyticsChatUsers,
  CottiPlatformAnalyticsChatUsersQuery,
  CottiPlatformAnalyticsDashboard,
  CottiPlatformAnalyticsFeatures,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

import { getCottiPlatformAnalyticsAgents } from './agents';
import { getCottiPlatformAnalyticsChatModels } from './chatModels';
import { getCottiPlatformAnalyticsChatUsers } from './chatUsers';
import {
  getCottiPlatformAnalyticsAgentErrors,
  getCottiPlatformAnalyticsChatErrors,
} from './errors';
import { getCottiPlatformAnalyticsFeatures } from './features';
import { getCottiPlatformAnalyticsOverview } from './overview';
import { resolveCottiPlatformAnalyticsPeriod } from './range';
import { getCottiPlatformAnalyticsTrends } from './trends';

export class CottiPlatformAnalyticsService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async getAgentErrors(
    query?: CottiPlatformAnalyticsAgentErrorsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsAgentErrors> {
    const period = resolveCottiPlatformAnalyticsPeriod(query?.range, now);
    const result = await getCottiPlatformAnalyticsAgentErrors(this.db, period, query);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
  }

  async getAgents(
    query?: CottiPlatformAnalyticsAgentsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsAgents> {
    const period = resolveCottiPlatformAnalyticsPeriod(query?.range, now);
    const result = await getCottiPlatformAnalyticsAgents(this.db, period, query);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
  }

  async getChatErrors(
    query?: CottiPlatformAnalyticsChatErrorsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsChatErrors> {
    const period = resolveCottiPlatformAnalyticsPeriod(query?.range, now);
    const result = await getCottiPlatformAnalyticsChatErrors(this.db, period, query);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
  }

  async getChatModels(
    query?: CottiPlatformAnalyticsChatModelsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsChatModels> {
    const period = resolveCottiPlatformAnalyticsPeriod(query?.range, now);
    const result = await getCottiPlatformAnalyticsChatModels(this.db, period, query);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
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

  async getFeatures(
    query?: CottiPlatformAnalyticsQuery,
    now = new Date(),
  ): Promise<CottiPlatformAnalyticsFeatures> {
    const period = resolveCottiPlatformAnalyticsPeriod(query, now);
    const result = await getCottiPlatformAnalyticsFeatures(this.db, period);
    const { endAtDate: _endAtDate, startAtDate: _startAtDate, ...publicPeriod } = period;

    return {
      generatedAt: now.toISOString(),
      period: publicPeriod,
      ...result,
    };
  }
}
