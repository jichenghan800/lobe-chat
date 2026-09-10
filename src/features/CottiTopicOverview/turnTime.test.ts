import { describe, expect, it } from 'vitest';

import { buildOverviewTurnTimeMap } from './turnTime';

describe('buildOverviewTurnTimeMap', () => {
  it('creates a persistent full timestamp for every user question', () => {
    const firstQuestionAt = Date.parse('2026-08-17T01:02:03.000Z');
    const secondQuestionAt = Date.parse('2026-08-17T03:04:05.000Z');
    const result = buildOverviewTurnTimeMap(
      [
        { createdAt: firstQuestionAt, id: 'user-1', role: 'user' },
        { createdAt: firstQuestionAt + 1000, id: 'assistant-1', role: 'assistant' },
        { createdAt: secondQuestionAt, id: 'user-2', role: 'user' },
        { createdAt: secondQuestionAt + 1000, id: 'tool-1', role: 'tool' },
      ],
      'zh-CN',
    );

    expect([...result.keys()]).toEqual(['user-1', 'user-2']);
    expect(result.get('user-1')).toEqual({
      dateTime: '2026-08-17T01:02:03.000Z',
      label: new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(firstQuestionAt)),
    });
  });

  it('skips user messages whose timestamp is invalid', () => {
    const result = buildOverviewTurnTimeMap(
      [{ createdAt: Number.NaN, id: 'invalid-user', role: 'user' }],
      'en-US',
    );

    expect(result.size).toBe(0);
  });
});
