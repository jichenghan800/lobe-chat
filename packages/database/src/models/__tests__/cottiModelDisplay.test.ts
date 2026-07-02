// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiModelDisplaySettings } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import {
  CottiModelDisplayModel,
  DEFAULT_COTTI_MODEL_DISPLAY_CONFIG,
  getEnabledModelDisplayItems,
} from '../cottiModelDisplay';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiModelDisplayModel(serverDB);

const cleanup = async () => {
  await serverDB.delete(cottiModelDisplaySettings);
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiModelDisplayModel', () => {
  it('returns the default config before settings are saved', async () => {
    await expect(model.getConfig()).resolves.toEqual(DEFAULT_COTTI_MODEL_DISPLAY_CONFIG);
  });

  it('stores and normalizes the singleton model display config', async () => {
    const settings = await model.updateConfig(
      {
        agent: [
          {
            displayName: '  全能效率  ',
            enabled: true,
            model: ' gpt-5.5 ',
            provider: ' openai ',
          },
          { displayName: '', enabled: true, model: '  ', provider: 'qwen' },
        ],
        chat: [
          {
            displayName: 'COTTI-快速',
            enabled: false,
            model: 'gemini-3.1-flash-lite',
            provider: 'vertexai',
          },
        ],
      },
      'admin-1',
    );

    expect(settings.updatedBy).toBe('admin-1');
    await expect(model.getConfig()).resolves.toEqual({
      agent: [{ displayName: '全能效率', enabled: true, model: 'gpt-5.5', provider: 'openai' }],
      chat: [
        {
          displayName: 'COTTI-快速',
          enabled: false,
          model: 'gemini-3.1-flash-lite',
          provider: 'vertexai',
        },
      ],
    });
  });

  it('returns enabled unique model refs across chat and agent lists', () => {
    expect(
      getEnabledModelDisplayItems({
        agent: [
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
        ],
        chat: [
          { enabled: false, model: 'gemini-3.1-flash-lite', provider: 'vertexai' },
          { enabled: true, model: 'gpt-5.5', provider: 'openai' },
        ],
      }),
    ).toEqual([{ enabled: true, model: 'gpt-5.5', provider: 'openai' }]);
  });
});
