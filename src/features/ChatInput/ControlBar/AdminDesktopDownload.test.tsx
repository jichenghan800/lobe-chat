import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminDesktopDownload } from './AdminDesktopDownload';

const state = vi.hoisted(() => ({
  user: { isSignedIn: true, user: { id: 'admin' } },
  access: {
    data: undefined as { allowed: boolean } | undefined,
    error: undefined as Error | undefined,
  },
  swr: vi.fn(),
}));
vi.mock('@lobehub/ui', () => ({ Icon: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => 'Download desktop' }) }));
vi.mock('@/const/url', () => ({ DOWNLOAD_URL: { default: 'https://example.com/download' } }));
vi.mock('@/services/cottiPeopleManagement', () => ({
  cottiPeopleManagementService: { getAccess: vi.fn() },
}));
vi.mock('@/store/user', () => ({
  useUserStore: (selector: (s: typeof state.user) => unknown) => selector(state.user),
}));
vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (...args: unknown[]) => {
    state.swr(...args);
    return state.access;
  },
}));

beforeEach(() => {
  state.user = { isSignedIn: true, user: { id: 'admin' } };
  state.access = { data: undefined, error: undefined };
  vi.clearAllMocks();
});

describe('admin desktop download entry', () => {
  it('exposes the existing download link for a confirmed administrator', () => {
    state.access.data = { allowed: true };
    render(<AdminDesktopDownload />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com/download');
    expect(state.swr.mock.calls[0][0]).toEqual(['cotti', 'admin-desktop-download', 'admin']);
  });
  it.each(['loading', 'denied', 'error', 'signed-out'])(
    'stays hidden for %s, including stale admin data',
    (scenario) => {
      if (scenario === 'denied') state.access.data = { allowed: false };
      if (scenario === 'error') state.access = { data: { allowed: true }, error: new Error('403') };
      if (scenario === 'signed-out') {
        state.user.isSignedIn = false;
        state.access.data = { allowed: true };
      }
      render(<AdminDesktopDownload />);
      expect(screen.queryByRole('link')).toBeNull();
      if (scenario === 'signed-out') expect(state.swr.mock.calls[0][0]).toBeNull();
    },
  );
  it('uses a different permission cache after switching accounts', () => {
    const { rerender } = render(<AdminDesktopDownload />);
    state.user.user.id = 'ordinary-user';
    rerender(<AdminDesktopDownload />);
    expect(state.swr.mock.lastCall?.[0]).toEqual([
      'cotti',
      'admin-desktop-download',
      'ordinary-user',
    ]);
  });
});
