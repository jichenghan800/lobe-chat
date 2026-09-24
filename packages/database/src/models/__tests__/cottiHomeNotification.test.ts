// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiHomeNotificationSettings } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import {
  CottiHomeNotificationModel,
  DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT,
} from '../cottiHomeNotification';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiHomeNotificationModel(serverDB);

const cleanup = async () => {
  await serverDB.delete(cottiHomeNotificationSettings);
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiHomeNotificationModel', () => {
  it('returns the disabled default config before settings are saved', async () => {
    await expect(model.getConfig()).resolves.toEqual({
      content: DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT,
      enabled: false,
    });
  });

  it('stores and updates the singleton home notification config', async () => {
    const first = await model.updateConfig(
      {
        content: '灵枢AI\n已进入待命状态\n带着新问题来了吧',
        enabled: true,
      },
      'admin-1',
    );

    expect(first.enabled).toBe(true);
    expect(first.updatedBy).toBe('admin-1');
    await expect(model.getConfig()).resolves.toEqual({
      content: '灵枢AI\n已进入待命状态\n带着新问题来了吧',
      enabled: true,
    });

    const second = await model.updateConfig({ content: '  ', enabled: false }, 'admin-2');

    expect(second.id).toBe(first.id);
    expect(second.content).toBe(DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT);
    expect(second.enabled).toBe(false);
    expect(second.updatedBy).toBe('admin-2');
  });
});
