import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface GlobalStateMock {
  toggleCommandMenu: () => void;
}

const mocks = vi.hoisted(() => ({
  activeWorkspaceSlug: null as string | null,
  isPlatformAdmin: false,
  platformManagementEnabled: true,
  showMarket: true,
}));

vi.mock('@/_custom/registry/platformManagement', () => ({
  isCottiPlatformManagementEnabled: () => mocks.platformManagementEnabled,
}));

vi.mock('@/features/CottiPlatformAnalytics/hooks', () => ({
  useCottiPlatformAdminAccess: () => ({ swr: { data: { isAdmin: mocks.isPlatformAdmin } } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/config/routes', () => ({
  getRouteById: (id: string) => ({
    icon: () => id,
  }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: GlobalStateMock) => unknown) =>
    selector({ toggleCommandMenu: vi.fn() }),
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: {},
  useServerConfigStore: () => ({
    hideGitHub: false,
    showMarket: mocks.showMarket,
  }),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceSlug', () => ({
  useActiveWorkspaceSlug: () => mocks.activeWorkspaceSlug,
}));

describe('useNavLayout', () => {
  beforeEach(() => {
    mocks.activeWorkspaceSlug = null;
    mocks.isPlatformAdmin = false;
    mocks.platformManagementEnabled = true;
    mocks.showMarket = true;
  });

  it('keeps Memory visible in personal mode', async () => {
    const { useNavLayout } = await import('./useNavLayout');
    const { result } = renderHook(() => useNavLayout());

    const memoryItem = result.current.bottomMenuItems.find((item) => item.key === 'memory');

    expect(memoryItem?.hidden).not.toBe(true);
  });

  it('hides Memory in workspace mode', async () => {
    mocks.activeWorkspaceSlug = 'lobe-team';

    const { useNavLayout } = await import('./useNavLayout');
    const { result } = renderHook(() => useNavLayout());

    const memoryItem = result.current.bottomMenuItems.find((item) => item.key === 'memory');

    expect(memoryItem?.hidden).toBe(true);
  });

  it('places Overview immediately before generation', async () => {
    mocks.isPlatformAdmin = true;
    const { useNavLayout } = await import('./useNavLayout');
    const { result } = renderHook(() => useNavLayout());
    const keys = result.current.bottomMenuItems
      .filter((item) => !item.hidden)
      .map((item) => item.key);
    expect(keys.indexOf('overview')).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf('image')).toBe(keys.indexOf('overview') + 1);
  });

  it('shows Overview only to platform administrators', async () => {
    const { useNavLayout } = await import('./useNavLayout');
    const initial = renderHook(() => useNavLayout());

    expect(
      initial.result.current.bottomMenuItems.find((item) => item.key === 'overview')?.hidden,
    ).toBe(true);

    mocks.isPlatformAdmin = true;
    initial.rerender();

    expect(
      initial.result.current.bottomMenuItems.find((item) => item.key === 'overview')?.hidden,
    ).toBe(false);
  });
});
