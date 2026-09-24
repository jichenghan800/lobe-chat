// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserAvatar from './index';

const mocks = vi.hoisted(() => ({
  trusted: true,
  authenticated: true,
  signIn: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
  openRecovery: vi.fn(),
  communityWorkspaceProfile: {
    avatarUrl: null as string | null,
    isWorkspaceScope: true,
    username: 'workspace-market-namespace',
  },
}));

vi.mock('@/business/client/hooks/useCommunityWorkspaceProfile', () => ({
  useCommunityWorkspaceProfile: () => mocks.communityWorkspaceProfile,
}));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => mocks.navigate,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    getCurrentUserInfo: () => ({ sub: 'current-user' }),
    isAuthenticated: mocks.authenticated,
    isLoading: false,
    signIn: mocks.signIn,
    signOut: mocks.signOut,
  }),
  useMarketUserProfile: () => ({
    data: { avatarUrl: 'user-avatar', namespace: 'personal-user', userName: 'personal-user' },
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: { enableMarketTrustedClient: boolean }) => boolean) =>
    selector({ enableMarketTrustedClient: mocks.trusted }),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  serverConfigSelectors: {
    enableMarketTrustedClient: (state: { enableMarketTrustedClient: boolean }) =>
      state.enableMarketTrustedClient,
  },
}));

vi.mock('@/features/MarketAccountRecoveryModal', () => ({
  openMarketAccountRecoveryModal: mocks.openRecovery,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.trusted = true;
  mocks.authenticated = true;
  mocks.signIn.mockResolvedValue(1);
  mocks.signOut.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Community UserAvatar', () => {
  it('uses the provided avatar override before workspace fallback', () => {
    render(<UserAvatar avatarOverride={'🏢'} />);

    expect(screen.getByRole('img', { name: '🏢' })).toBeInTheDocument();
  });
  it('restores the personal profile and community-only sign-out menu', async () => {
    mocks.trusted = false;
    render(<UserAvatar />);
    fireEvent.click(screen.getByRole('button', { name: 'user.accountMenu' }));
    fireEvent.click(await screen.findByText('user.myProfile'));
    expect(mocks.navigate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'user.accountMenu' }));
    fireEvent.click(await screen.findByText('user.logout'));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
  it('does not expose manual sign-out for trusted-client workspaces', () => {
    render(<UserAvatar />);
    expect(screen.queryByRole('button', { name: 'user.accountMenu' })).not.toBeInTheDocument();
  });
  it('offers the old account recovery guide after an explicit denial', async () => {
    mocks.trusted = false;
    mocks.authenticated = false;
    mocks.signIn.mockRejectedValue(new Error('access_denied'));
    render(<UserAvatar />);
    fireEvent.click(screen.getByText('user.login'));
    fireEvent.click(await screen.findByText('user.switchAccount'));
    expect(mocks.openRecovery).toHaveBeenCalledWith(expect.any(Function));
  });
  it('does not suggest clearing site data after the user cancels', async () => {
    mocks.trusted = false;
    mocks.authenticated = false;
    mocks.signIn.mockRejectedValue(new Error('User cancelled authorization'));
    render(<UserAvatar />);
    fireEvent.click(screen.getByText('user.login'));
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('user.switchAccount')).not.toBeInTheDocument();
  });
});
