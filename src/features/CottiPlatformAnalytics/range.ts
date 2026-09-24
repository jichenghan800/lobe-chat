import type {
  CottiPlatformAnalyticsPresetDays,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

export type CottiPlatformAnalyticsRangeMode = CottiPlatformAnalyticsPresetDays | 'custom';

export type CottiPlatformAnalyticsRangeSelection =
  | {
      days: CottiPlatformAnalyticsPresetDays;
      type: 'preset';
    }
  | {
      endDate: string;
      startDate: string;
      type: 'custom';
    };

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS = new Set<CottiPlatformAnalyticsPresetDays>([1, 7, 30, 90]);
const DEFAULT_PRESET_DAYS: CottiPlatformAnalyticsPresetDays = 7;
const CUSTOM_RANGE_MAX_DAYS = 90;

const parseDateOnly = (value: string | null | undefined) => {
  if (!value || !DATE_ONLY_PATTERN.test(value)) return;

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

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const shiftCottiPlatformAnalyticsDate = (value: string, days: number) => {
  const date = parseDateOnly(value);
  if (!date) throw new Error(`Invalid date-only value: ${value}`);

  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
};

const getShanghaiDateOnly = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

export const getDefaultCottiPlatformAnalyticsCustomRange = (now = new Date()) => {
  const endDate = getShanghaiDateOnly(now);

  return {
    endDate,
    startDate: shiftCottiPlatformAnalyticsDate(endDate, -6),
    type: 'custom' as const,
  };
};

const isValidCustomRange = (startDate: string, endDate: string) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return false;

  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return spanDays >= 1 && spanDays <= CUSTOM_RANGE_MAX_DAYS;
};

export const parseCottiPlatformAnalyticsRange = (
  searchParams: Pick<URLSearchParams, 'get'>,
  now = new Date(),
): CottiPlatformAnalyticsRangeSelection => {
  const range = searchParams.get('range');

  if (range === 'custom') {
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (startDate && endDate && isValidCustomRange(startDate, endDate)) {
      return { endDate, startDate, type: 'custom' };
    }

    return getDefaultCottiPlatformAnalyticsCustomRange(now);
  }

  const days = Number(range || DEFAULT_PRESET_DAYS) as CottiPlatformAnalyticsPresetDays;
  return PRESET_DAYS.has(days)
    ? { days, type: 'preset' }
    : { days: DEFAULT_PRESET_DAYS, type: 'preset' };
};

export const getCottiPlatformAnalyticsRangeMode = (
  range: CottiPlatformAnalyticsRangeSelection,
): CottiPlatformAnalyticsRangeMode => (range.type === 'custom' ? 'custom' : range.days);

export const normalizeCottiPlatformAnalyticsCustomRange = (
  range: Extract<CottiPlatformAnalyticsRangeSelection, { type: 'custom' }>,
  field: 'endDate' | 'startDate',
  value: string,
) => {
  if (!parseDateOnly(value)) return range;

  let startDate = field === 'startDate' ? value : range.startDate;
  let endDate = field === 'endDate' ? value : range.endDate;

  if (startDate > endDate) {
    if (field === 'startDate') endDate = startDate;
    else startDate = endDate;
  }

  const start = parseDateOnly(startDate)!;
  const end = parseDateOnly(endDate)!;
  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (spanDays > CUSTOM_RANGE_MAX_DAYS) {
    if (field === 'startDate') endDate = shiftCottiPlatformAnalyticsDate(startDate, 89);
    else startDate = shiftCottiPlatformAnalyticsDate(endDate, -89);
  }

  return { endDate, startDate, type: 'custom' as const };
};

export const writeCottiPlatformAnalyticsRange = (
  current: URLSearchParams,
  range: CottiPlatformAnalyticsRangeSelection,
) => {
  const next = new URLSearchParams(current);

  if (range.type === 'preset') {
    next.set('range', String(range.days));
    next.delete('start');
    next.delete('end');
  } else {
    next.set('range', 'custom');
    next.set('start', range.startDate);
    next.set('end', range.endDate);
  }

  return next;
};

export const toCottiPlatformAnalyticsQuery = (
  range: CottiPlatformAnalyticsRangeSelection,
): CottiPlatformAnalyticsQuery => range;
