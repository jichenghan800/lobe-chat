import { ChatErrorType } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import useBusinessErrorContent from './useBusinessErrorContent';

describe('topic cost policy errors', () => {
  it('shows the actionable topic rejection instead of a generic bad-request label', () => {
    expect(
      useBusinessErrorContent({
        body: { error: { code: 'TOPIC_COST_FROZEN', message: '此话题已冻结，请新建话题。' } },
        type: ChatErrorType.BadRequest,
      }),
    ).toEqual({ message: '此话题已冻结，请新建话题。' });
  });

  it('leaves unrelated and missing error payloads to native rendering', () => {
    expect(useBusinessErrorContent(null)).toEqual({});
    expect(
      useBusinessErrorContent({
        body: { error: { code: 'OTHER_ERROR', message: 'other' } },
        type: ChatErrorType.BadRequest,
      }),
    ).toEqual({});
  });
});
