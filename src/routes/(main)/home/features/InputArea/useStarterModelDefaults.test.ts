import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { COTTI_FAST_MODEL } from './starterModels';
import { useStarterModelDefaults } from './useStarterModelDefaults';

const mocks = vi.hoisted(() => ({
  enableBusinessFeatures: false,
}));

vi.mock('@/store/serverConfig', () => ({
  serverConfigSelectors: {
    enableBusinessFeatures: (state: { enableBusinessFeatures: boolean }) =>
      state.enableBusinessFeatures,
  },
  useServerConfigStore: <T>(selector: (state: { enableBusinessFeatures: boolean }) => T) =>
    selector({ enableBusinessFeatures: mocks.enableBusinessFeatures }),
}));

beforeEach(() => {
  mocks.enableBusinessFeatures = false;
});

describe('useStarterModelDefaults', () => {
  it('uses the OSS fallback home new model entries in the current product order', () => {
    const { result } = renderHook(() => useStarterModelDefaults());

    expect(COTTI_FAST_MODEL).toBe('gemini-3.1-flash-lite');
    expect(result.current.fallbackChatProvider).toBe('vertexai');
    expect(result.current.defaultHomeNewModels).toEqual([
      {
        model: 'gemini-3.1-flash-lite',
        provider: 'vertexai',
        title: 'COTTI-快速',
        type: 'chat',
      },
      {
        model: 'gpt-5.6-terra',
        provider: 'azure',
        title: 'GPT-5.6 Terra',
        type: 'chat',
      },
      {
        model: 'doubao-seedream-5-0-pro-260628',
        provider: 'volcengine',
        title: 'Seedream 5.0 Pro',
        type: 'image',
      },
      {
        model: 'dreamina-seedance-2-0-260128',
        title: 'Seedance 2.0',
        type: 'video',
      },
    ]);
  });

  it('uses the business fallback home new model entries in the current product order', () => {
    mocks.enableBusinessFeatures = true;

    const { result } = renderHook(() => useStarterModelDefaults());

    expect(result.current.fallbackChatProvider).toBe('lobehub');
    expect(result.current.defaultHomeNewModels).toEqual([
      {
        model: 'gemini-3.1-flash-lite',
        provider: 'lobehub',
        title: 'COTTI-快速',
        type: 'chat',
      },
      {
        model: 'gpt-5.6-terra',
        provider: 'azure',
        title: 'GPT-5.6 Terra',
        type: 'chat',
      },
      {
        model: 'doubao-seedream-5-0-pro-260628',
        provider: 'volcengine',
        title: 'Seedream 5.0 Pro',
        type: 'image',
      },
      {
        model: 'dreamina-seedance-2-0-260128',
        title: 'Seedance 2.0',
        type: 'video',
      },
    ]);
  });
});
