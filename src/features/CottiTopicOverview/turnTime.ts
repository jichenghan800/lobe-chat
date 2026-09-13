import type { UIChatMessage } from '@lobechat/types';

export interface OverviewTurnTime {
  dateTime: string;
  label: string;
}

type OverviewTurnMessage = Pick<UIChatMessage, 'createdAt' | 'id' | 'role'>;

/**
 * Build the persistent timestamps that separate user question-and-answer turns
 * in the read-only overview transcript.
 */
export const buildOverviewTurnTimeMap = (
  messages: OverviewTurnMessage[],
  locale: string,
): ReadonlyMap<string, OverviewTurnTime> => {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  const turnTimes = new Map<string, OverviewTurnTime>();

  for (const message of messages) {
    if (message.role !== 'user') continue;

    const date = new Date(message.createdAt);
    if (Number.isNaN(date.getTime())) continue;

    turnTimes.set(message.id, {
      dateTime: date.toISOString(),
      label: formatter.format(date),
    });
  }

  return turnTimes;
};
