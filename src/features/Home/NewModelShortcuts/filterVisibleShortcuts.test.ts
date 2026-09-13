import { describe, expect, it } from 'vitest';

import { filterVisibleShortcuts } from './filterVisibleShortcuts';
import { OSS_HOME_NEW_MODELS } from './starterModels';

describe('COTTI home model shortcuts', () => {
  const items = [
    { model: 'fast', provider: 'vertexai', title: 'Native fast', type: 'chat' as const },
    { model: 'hidden', provider: 'qwen', title: 'Hidden', type: 'chat' as const },
    { model: 'image', title: 'Image', type: 'image' as const },
    { model: 'missing', title: 'Video', type: 'video' as const },
  ];
  const models = [
    { id: 'fast', providerId: 'vertexai', type: 'chat' },
    { id: 'hidden', providerId: 'qwen', type: 'chat' },
    { id: 'image', providerId: 'azure', type: 'image' },
  ];
  const config = {
    agent: [],
    chat: [{ model: 'fast', provider: 'vertexai', enabled: true, displayName: 'COTTI-快速' }],
  };
  it('excludes hidden and unavailable models and uses the configured name', () => {
    expect(filterVisibleShortcuts(items, models, config, 'openai')).toEqual([
      { ...items[0], title: 'COTTI-快速' },
      items[2],
    ]);
  });
  it('does not offer chat shortcuts while configuration is loading', () => {
    expect(filterVisibleShortcuts(items, models, undefined, 'openai')).toEqual([items[2]]);
  });
  it('does not treat the same ID on a different provider as available', () => {
    expect(
      filterVisibleShortcuts(
        [items[0]],
        [{ ...models[0], providerId: 'openai' }],
        config,
        'openai',
      ),
    ).toEqual([]);
  });
});

describe('home discovery with the configured COTTI catalog', () => {
  const models = [
    { id: 'gemini-3.5-flash-lite', providerId: 'vertexai', type: 'chat' },
    { id: 'gpt-5.6-terra', providerId: 'azure', type: 'chat' },
    { id: 'gpt-image-2.5-flare', providerId: 'azure', type: 'image' },
  ];
  const config = {
    agent: [],
    chat: [
      { model: models[0].id, provider: 'vertexai', enabled: true, displayName: 'COTTI-快速' },
      { model: models[1].id, provider: 'azure', enabled: true, displayName: 'GPT-5.6 Terra' },
    ],
  };

  it('offers both deployed chat models in their historical order alongside the available image model', () => {
    const result = filterVisibleShortcuts([...OSS_HOME_NEW_MODELS], models, config, 'vertexai');
    expect(result.map(({ title }) => title)).toEqual([
      'COTTI-快速',
      'GPT-5.6 Terra',
      'GPT Image 2.5 Flare',
    ]);
    expect(result.slice(0, 2).map(({ model, provider }) => ({ model, provider }))).toEqual([
      { model: models[0].id, provider: 'vertexai' },
      { model: models[1].id, provider: 'azure' },
    ]);
  });

  it('removes a retired chat shortcut instead of bypassing platform visibility', () => {
    const retired = {
      ...config,
      chat: config.chat.map((item) => ({ ...item, enabled: item.provider !== 'azure' })),
    };
    expect(
      filterVisibleShortcuts([...OSS_HOME_NEW_MODELS], models, retired, 'vertexai').map(
        ({ title }) => title,
      ),
    ).toEqual(['COTTI-快速', 'GPT Image 2.5 Flare']);
  });

  it('uses the administrator display name without changing the model target', () => {
    const renamed = {
      ...config,
      chat: config.chat.map((item) => ({ ...item, displayName: 'Managed ' + item.provider })),
    };
    expect(
      filterVisibleShortcuts([...OSS_HOME_NEW_MODELS], models, renamed, 'vertexai')[0],
    ).toMatchObject({ title: 'Managed vertexai', model: models[0].id, provider: 'vertexai' });
  });
});

it('hides video shortcuts even if a video model is enabled', () => {
  expect(
    filterVisibleShortcuts(
      [{ model: 'video-model', title: 'Video', type: 'video' }],
      [{ id: 'video-model', providerId: 'test', type: 'video' }],
      undefined,
      'test',
    ),
  ).toEqual([]);
});
