import { describe, expect, it } from 'vitest';

import { getOverviewTopicId } from './topicLink';

describe('overview topic links', () => {
  const id = 'tpc_t1SSaYPz2nK5';
  const link = `https://chat.cotti.ai/agent/agt_wBr9xdY8Oxqm/${id}`;

  it.each([link, ` ${link} `, `${link}/?view=chat#last`, id])(
    'extracts the case-sensitive topic ID from %s',
    (input) => expect(getOverviewTopicId(input)).toBe(id),
  );

  it('supports workspace links and long query strings without copying origin or query', () => {
    expect(
      getOverviewTopicId(
        `https://chatdev.cotticoffee.com/team/agent/agt_test/${id}?q=${'x'.repeat(300)}`,
      ),
    ).toBe(id);
  });

  it.each([
    '课程指导',
    'javascript:alert(1)',
    `file:///agent/agt_test/${id}`,
    `https://chat.cotti.ai/?redirect=${link}`,
    `${link}/documents`,
    `${link}.`,
    'https://chat.cotti.ai/share/t/abc',
    '',
  ])('leaves ordinary searches and unsupported links unchanged: %s', (input) => {
    expect(getOverviewTopicId(input)).toBeUndefined();
  });
});
