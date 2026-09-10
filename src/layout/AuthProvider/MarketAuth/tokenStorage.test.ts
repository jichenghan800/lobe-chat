import { DEFAULT_SETTINGS } from '@lobechat/config';
import type { UserSettings } from '@lobechat/types';
import type { PartialDeep } from 'type-fest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { userService } from '@/services/user';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/slices/settings/selectors/settings';

import { clearMarketTokensFromDB } from './tokenStorage';

vi.mock('@/services/user', () => ({
  userService: { updateUserSettings: vi.fn() },
}));

describe('clearMarketTokensFromDB', () => {
  const initialState = useUserStore.getState();
  let persisted: PartialDeep<UserSettings>;

  beforeEach(() => {
    persisted = {
      general: { fontSize: 17 },
      market: { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresAt: 1 },
    };
    useUserStore.setState({
      defaultSettings: DEFAULT_SETTINGS,
      settings: structuredClone(persisted),
      refreshUserState: async () => {
        useUserStore.setState({ settings: structuredClone(persisted) });
      },
    });
    vi.mocked(userService.updateUserSettings).mockImplementation(async (payload) => {
      persisted = { ...persisted, ...payload };
      return { command: 'UPDATE', fields: [], oid: 0, rowCount: 1, rows: [] };
    });
  });

  afterEach(() => {
    useUserStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  it('persists token removal and keeps it removed after settings reload', async () => {
    await clearMarketTokensFromDB();
    expect(persisted.market).toBeNull();
    await useUserStore.getState().refreshUserState();
    expect(settingsSelectors.currentSettings(useUserStore.getState()).market).toBeNull();
    expect(persisted.general?.fontSize).toBe(17);
  });

  it('does not write again when credentials are already cleared', async () => {
    await clearMarketTokensFromDB();
    vi.mocked(userService.updateUserSettings).mockClear();
    await clearMarketTokensFromDB();
    expect(userService.updateUserSettings).not.toHaveBeenCalled();
  });
  it('reports manual sign-out persistence failures while keeping background cleanup non-throwing', async () => {
    vi.mocked(userService.updateUserSettings).mockRejectedValue(new Error('database unavailable'));
    await expect(clearMarketTokensFromDB({ throwOnError: true })).rejects.toThrow(
      'database unavailable',
    );
    expect(persisted.market?.refreshToken).toBe('synthetic-refresh');
    expect(settingsSelectors.currentSettings(useUserStore.getState()).market?.refreshToken).toBe(
      'synthetic-refresh',
    );
    await expect(clearMarketTokensFromDB({ throwOnError: true })).rejects.toThrow(
      'database unavailable',
    );
    expect(userService.updateUserSettings).toHaveBeenCalledTimes(2);
    await expect(clearMarketTokensFromDB()).resolves.toBeUndefined();
  });
});
