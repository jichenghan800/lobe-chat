import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mapFeatureFlagsEnvToState } from '@/config/featureFlags';
import { SettingsTabs } from '@/store/global/initialState';
import { initServerConfigStore, Provider } from '@/store/serverConfig/store';
import { useUserStore } from '@/store/user';

import { useCategory } from './useCategory';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
  });
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createWrapper = (showProvider: boolean) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider
      createStore={() =>
        initServerConfigStore({
          featureFlags: {
            ...mapFeatureFlagsEnvToState({
              provider_settings: true,
            }),
            showProvider,
          },
        })
      }
    >
      {children}
    </Provider>
  );

  return Wrapper;
};

const getItemKeys = () => {
  const { result } = renderHook(() => useCategory(), {
    wrapper: createWrapper(true),
  });

  return result.current.flatMap((group) => group.items.map((item) => item.key));
};

const initialUserStoreState = useUserStore.getState();

afterEach(() => {
  delete process.env.NEXT_PUBLIC_COTTI_HIDE_MODEL_PROVIDER_SETTINGS;
  delete process.env.NEXT_PUBLIC_COTTI_HIDE_SERVICE_MODEL_SETTINGS;
  delete process.env.NEXT_PUBLIC_COTTI_HIDE_MESSENGER_SETTINGS;
  delete process.env.NEXT_PUBLIC_COTTI_HIDE_API_KEY_SETTINGS;
  useUserStore.setState(initialUserStoreState, true);
});

describe('settings useCategory', () => {
  it('keeps Provider visible when provider settings are enabled', () => {
    process.env.NEXT_PUBLIC_COTTI_HIDE_MODEL_PROVIDER_SETTINGS = 'false';

    expect(getItemKeys()).toContain(SettingsTabs.Provider);
  });

  it('hides Provider when provider settings are disabled', () => {
    process.env.NEXT_PUBLIC_COTTI_HIDE_MODEL_PROVIDER_SETTINGS = 'false';

    const { result } = renderHook(() => useCategory(), {
      wrapper: createWrapper(false),
    });

    const keys = result.current.flatMap((group) => group.items.map((item) => item.key));

    expect(keys).not.toContain(SettingsTabs.Provider);
  });

  it('hides platform-management settings by default for Cotti customization', () => {
    expect(getItemKeys()).not.toEqual(
      expect.arrayContaining([
        SettingsTabs.Provider,
        SettingsTabs.ServiceModel,
        SettingsTabs.Messenger,
        SettingsTabs.APIKey,
      ]),
    );
  });
});
