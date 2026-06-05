import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { resolvePersistableParentId } from './resolvePersistableParentId';

describe('resolvePersistableParentId', () => {
  it('keeps persisted parent ids unchanged', () => {
    expect(resolvePersistableParentId('msg_parent', [])).toBe('msg_parent');
  });

  it('uses the nearest previous persisted message for a temporary parent id', () => {
    const messages = [
      { id: 'msg_1', role: 'user', content: 'first' },
      { id: 'msg_2', role: 'assistant', content: 'second' },
      { id: 'tmp_user', role: 'user', content: 'temporary' },
    ] as UIChatMessage[];

    expect(resolvePersistableParentId('tmp_user', messages)).toBe('msg_2');
  });

  it('returns undefined when a temporary parent has no persisted predecessor', () => {
    const messages = [{ id: 'tmp_user', role: 'user', content: 'temporary' }] as UIChatMessage[];

    expect(resolvePersistableParentId('tmp_user', messages)).toBeUndefined();
  });
});
