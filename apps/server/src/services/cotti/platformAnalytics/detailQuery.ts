import type { SQLWrapper } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import type { CottiPlatformAnalyticsDetailQuery } from '@/types/cotti/platformAnalytics';

import { cottiPlatformAnalyticsQuerySchema } from './range';

export const COTTI_PLATFORM_ANALYTICS_DEFAULT_PAGE = 1;
export const COTTI_PLATFORM_ANALYTICS_DEFAULT_PAGE_SIZE = 20;
export const COTTI_PLATFORM_ANALYTICS_MAX_PAGE_SIZE = 50;

export const cottiPlatformAnalyticsDetailQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(COTTI_PLATFORM_ANALYTICS_MAX_PAGE_SIZE).optional(),
  q: z.string().trim().max(100).optional(),
  range: cottiPlatformAnalyticsQuerySchema.optional(),
});

export interface NormalizedCottiPlatformAnalyticsDetailQuery<TSort extends string> {
  page: number;
  pageSize: number;
  q?: string;
  sortBy: TSort;
}

const escapeLikePattern = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');

export const buildCottiPlatformAnalyticsContainsCondition = (
  column: SQLWrapper,
  q: string | undefined,
) => {
  const normalized = q?.trim();
  if (!normalized) return;

  return sql<boolean>`${column} ILIKE ${`%${escapeLikePattern(normalized)}%`} ESCAPE '\\'`;
};

export const normalizeCottiPlatformAnalyticsDetailQuery = <TSort extends string>(
  query: (CottiPlatformAnalyticsDetailQuery & { sortBy?: TSort }) | undefined,
  defaultSort: TSort,
): NormalizedCottiPlatformAnalyticsDetailQuery<TSort> => {
  const q = query?.q?.trim();

  return {
    page: query?.page ?? COTTI_PLATFORM_ANALYTICS_DEFAULT_PAGE,
    pageSize: query?.pageSize ?? COTTI_PLATFORM_ANALYTICS_DEFAULT_PAGE_SIZE,
    q: q || undefined,
    sortBy: query?.sortBy ?? defaultSort,
  };
};
