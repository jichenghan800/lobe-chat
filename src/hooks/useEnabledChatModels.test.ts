import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { useEnabledChatModels } from './useEnabledChatModels';

const testState = vi.hoisted(() => ({
  config: undefined as ModelDisplayConfig | undefined,
  enabledChatModelList: [
    {
      children: [
        { displayName: 'Fast', id: 'fast' },
        { displayName: 'Pro', id: 'pro' },
      ],
      id: 'vertexai',
    },
  ],
}));

vi.mock('@/_custom/hooks/useCottiModelDisplayConfig', () => ({
  useCottiModelDisplayConfig: () => ({ data: testState.config }),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: (state: typeof testState) => unknown) => selector(testState),
}));

beforeEach(() => {
  testState.config = {
    agent: [{ displayName: 'COTTI-专业', enabled: true, model: 'pro', provider: 'vertexai' }],
    chat: [{ displayName: 'COTTI-快速', enabled: true, model: 'fast', provider: 'vertexai' }],
  };
});

describe('useEnabledChatModels', () => {
  it('returns only Chat models for the Chat scope', () => {
    const { result } = renderHook(() => useEnabledChatModels('chat'));

    expect(result.current).toEqual([
      {
        children: [{ displayName: 'COTTI-快速', id: 'fast' }],
        id: 'vertexai',
      },
    ]);
  });

  it('returns only Agent models for the Agent scope', () => {
    const { result } = renderHook(() => useEnabledChatModels('agent'));

    expect(result.current).toEqual([
      {
        children: [{ displayName: 'COTTI-专业', id: 'pro' }],
        id: 'vertexai',
      },
    ]);
  });

  it('preserves the upstream model list when no COTTI scope is requested', () => {
    const { result } = renderHook(() => useEnabledChatModels());

    expect(result.current).toEqual(testState.enabledChatModelList);
  });

  it('preserves the server-filtered union while the scope config is loading', () => {
    testState.config = undefined;

    const { result } = renderHook(() => useEnabledChatModels('chat'));

    expect(result.current).toEqual(testState.enabledChatModelList);
  });
});
