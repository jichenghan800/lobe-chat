import { z } from 'zod';

import type {
  CottiPlatformAnalyticsPeriod,
  CottiPlatformAnalyticsPresetDays,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

export const COTTI_PLATFORM_ANALYTICS_TIMEZONE = 'Asia/Shanghai' as const;

const CUSTOM_RANGE_MAX_DAYS = 90;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PRESET_DAYS: CottiPlatformAnalyticsPresetDays = 7;
const SHANGHAI_UTC_OFFSET = '+08:00';

const parseDateOnly = (value: string) => {
  if (!DATE_ONLY_PATTERN.test(value)) return;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return;
  }

  return date;
};

const dateOnlySchema = z
  .string()
  .regex(DATE_ONLY_PATTERN, 'Expected a YYYY-MM-DD date')
  .refine((value) => Boolean(parseDateOnly(value)), 'Expected a valid calendar date');

const presetDaysSchema = z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]);

export const cottiPlatformAnalyticsQuerySchema = z.discriminatedUnion('type', [
  z.object({
    days: presetDaysSchema,
    type: z.literal('preset'),
  }),
  z
    .object({
      endDate: dateOnlySchema,
      startDate: dateOnlySchema,
      type: z.literal('custom'),
    })
    .superRefine(({ endDate, startDate }, ctx) => {
      const start = parseDateOnly(startDate);
      const end = parseDateOnly(endDate);
      if (!start || !end) return;

      const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
      if (spanDays < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'endDate must be on or after startDate',
          path: ['endDate'],
        });
      } else if (spanDays > CUSTOM_RANGE_MAX_DAYS) {
        ctx.addIssue({
          code: 'custom',
          message: `Custom range cannot exceed ${CUSTOM_RANGE_MAX_DAYS} days`,
          path: ['endDate'],
        });
      }
    }),
]);

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const shiftDateOnly = (value: string, days: number) => {
  const date = parseDateOnly(value);
  if (!date) throw new Error(`Invalid date-only value: ${value}`);

  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
};

const getShanghaiDateOnly = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: COTTI_PLATFORM_ANALYTICS_TIMEZONE,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const shanghaiDayStart = (dateOnly: string) =>
  new Date(`${dateOnly}T00:00:00${SHANGHAI_UTC_OFFSET}`);

export interface ResolvedCottiPlatformAnalyticsPeriod extends CottiPlatformAnalyticsPeriod {
  endAtDate: Date;
  startAtDate: Date;
}

export const resolveCottiPlatformAnalyticsPeriod = (
  query: CottiPlatformAnalyticsQuery | undefined,
  now = new Date(),
): ResolvedCottiPlatformAnalyticsPeriod => {
  const normalizedQuery: CottiPlatformAnalyticsQuery = query ?? {
    days: DEFAULT_PRESET_DAYS,
    type: 'preset',
  };

  if (normalizedQuery.type === 'custom') {
    const startAtDate = shanghaiDayStart(normalizedQuery.startDate);
    const endAtDate = shanghaiDayStart(shiftDateOnly(normalizedQuery.endDate, 1));

    return {
      endAt: endAtDate.toISOString(),
      endAtDate,
      endDate: normalizedQuery.endDate,
      startAt: startAtDate.toISOString(),
      startAtDate,
      startDate: normalizedQuery.startDate,
      timezone: COTTI_PLATFORM_ANALYTICS_TIMEZONE,
      type: 'custom',
    };
  }

  const endDate = getShanghaiDateOnly(now);
  const startDate = shiftDateOnly(endDate, -(normalizedQuery.days - 1));
  const startAtDate = shanghaiDayStart(startDate);

  return {
    endAt: now.toISOString(),
    endAtDate: now,
    endDate,
    presetDays: normalizedQuery.days,
    startAt: startAtDate.toISOString(),
    startAtDate,
    startDate,
    timezone: COTTI_PLATFORM_ANALYTICS_TIMEZONE,
    type: 'preset',
  };
};

export const listCottiPlatformAnalyticsDays = (startDate: string, endDate: string) => {
  const days: string[] = [];

  for (let day = startDate; day <= endDate; day = shiftDateOnly(day, 1)) {
    days.push(day);
  }

  return days;
};
