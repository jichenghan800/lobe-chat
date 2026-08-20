import { describe, expect, it } from 'vitest';

import { CHAT_INPUT_MODE_ORDER } from './modeOrder';

describe('chat input mode order', () => {
  it('keeps Chat before Agent in every conversation mode selector', () => {
    expect(CHAT_INPUT_MODE_ORDER).toEqual(['chat', 'agent']);
  });
});
