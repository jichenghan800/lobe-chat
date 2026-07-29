// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserAvatar from './index';

const mocks = vi.hoisted(() => ({
  communityWorkspaceProfile: {
    avatarUrl: null as string | null,
    isWorkspaceScope: true,
    username: 'workspace-market-namespace',
  },
  enableMarketTrustedClient: true,
  isAuthenticated: true,
  lastAuthError: null as string | null,
  navigate: vi.fn(),
  openAccountRecovery: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  toastPromise: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: ({ avatar, onClick }: { avatar?: string | null; onClick?: () => void }) => (
    <button data-avatar={avatar ?? ''} data-testid="community-user-avatar" onClick={onClick} />
  ),
  Button: ({ children, onClick }: { children?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Flexbox: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Skeleton: {
    Avatar: () => <div data-testid="avatar-skeleton" />,
  },
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  DropdownMenu: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: Array<{
      disabled?: boolean;
      key?: React.Key;
      label?: React.ReactNode;
      onClick?: () => void;
    } | null>;
  }) => (
    <div>
      {children}
      {items.map((item) =>
        item ? (
          <button disabled={item.disabled} key={item.key} onClick={item.onClick}>
            {item.label}
          </button>
        ) : null,
      )}
    </div>
  ),
  toast: {
    promise: mocks.toastPromise,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/business/client/hooks/useCommunityWorkspaceProfile', () => ({
  useCommunityWorkspaceProfile: () => mocks.communityWorkspaceProfile,
}));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => mocks.navigate,
}));

vi.mock('@/features/MarketAccountRecoveryModal', () => ({
  openMarketAccountRecoveryModal: mocks.openAccountRecovery,
}));

vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({
    getCurrentUserInfo: () => ({ sub: 'current-user' }),
    isAuthenticated: mocks.isAuthenticated,
    isLoading: false,
    lastAuthError: mocks.lastAuthError,
    signIn: mocks.signIn,
    signOut: mocks.signOut,
  }),
  useMarketUserProfile: () => ({
    data: { avatarUrl: 'user-avatar', namespace: 'personal-user', userName: 'personal-user' },
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: { enableMarketTrustedClient: boolean }) => boolean) =>
    selector({ enableMarketTrustedClient: mocks.enableMarketTrustedClient }),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  serverConfigSelectors: {
    enableMarketTrustedClient: (state: { enableMarketTrustedClient: boolean }) =>
      state.enableMarketTrustedClient,
  },
}));

describe('Community UserAvatar', () => {
  beforeEach(() => {
    mocks.enableMarketTrustedClient = true;
    mocks.isAuthenticated = true;
    mocks.lastAuthError = null;
    mocks.navigate.mockReset();
    mocks.openAccountRecovery.mockReset();
    mocks.signIn.mockReset();
    mocks.signIn.mockResolvedValue(null);
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined);
    mocks.toastPromise.mockReset();
    mocks.toastPromise.mockImplementation(async (promise: Promise<void>) => promise);
  });

  it('uses the provided avatar override before workspace fallback', () => {
    render(<UserAvatar avatarOverride={'🏢'} />);

    expect(screen.getByTestId('community-user-avatar')).toHaveAttribute('data-avatar', '🏢');
  });

  it('keeps trusted-client avatar navigation without a sign-out action', () => {
    render(<UserAvatar />);

    fireEvent.click(screen.getByTestId('community-user-avatar'));

    expect(mocks.navigate).toHaveBeenCalledWith('/community/workspace');
    expect(screen.queryByText('user.logout')).not.toBeInTheDocument();
  });

  it('signs out of Community from the authenticated avatar menu', async () => {
    mocks.enableMarketTrustedClient = false;
    render(<UserAvatar />);

    fireEvent.click(screen.getByText('user.logout'));

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastPromise).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.objectContaining({
        error: 'user.logout.error',
        loading: 'user.logout.loading',
        success: 'user.logout.success',
      }),
    );
  });

  it('offers account recovery only after Community authorization is denied', () => {
    mocks.enableMarketTrustedClient = false;
    mocks.isAuthenticated = false;
    mocks.lastAuthError = 'authorizationDenied';

    render(<UserAvatar />);

    fireEvent.click(screen.getByText('user.switchAccount'));

    expect(mocks.openAccountRecovery).toHaveBeenCalledWith(expect.any(Function));
  });

  it('keeps account recovery hidden for a normal signed-out state', () => {
    mocks.enableMarketTrustedClient = false;
    mocks.isAuthenticated = false;

    render(<UserAvatar />);

    expect(screen.getByText('user.login')).toBeInTheDocument();
    expect(screen.queryByText('user.switchAccount')).not.toBeInTheDocument();
  });
});
