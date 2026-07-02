import { describe, expect, it } from 'vitest';

import { applyModelDisplayConfig } from './modelDisplayConfig';

describe('applyModelDisplayConfig', () => {
  it('filters, sorts and renames provider model lists from display config', () => {
    const result = applyModelDisplayConfig(
      [
        {
          children: [
            { displayName: 'Azure GPT', id: 'gpt-5.5' },
            { displayName: 'GPT 4o', id: 'gpt-4o' },
          ],
          id: 'azure',
        },
        {
          children: [{ displayName: 'OpenAI GPT', id: 'gpt-5.5' }],
          id: 'openai',
        },
      ],
      [
        { displayName: '全能效率', enabled: true, model: 'gpt-5.5', provider: 'openai' },
        { displayName: 'Azure 全能', enabled: true, model: 'gpt-5.5', provider: 'azure' },
        { enabled: false, model: 'gpt-4o', provider: 'azure' },
      ],
    );

    expect(result).toEqual([
      {
        children: [{ displayName: '全能效率', id: 'gpt-5.5' }],
        id: 'openai',
      },
      {
        children: [{ displayName: 'Azure 全能', id: 'gpt-5.5' }],
        id: 'azure',
      },
    ]);
  });

  it('returns undefined when config has not loaded', () => {
    expect(
      applyModelDisplayConfig([{ children: [{ id: 'gpt-5.5' }], id: 'openai' }], undefined),
    ).toBeUndefined();
  });
});
