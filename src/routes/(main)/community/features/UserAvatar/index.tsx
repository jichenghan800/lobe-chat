'use client';

import { Flexbox } from '@lobehub/ui';
import type { DropdownItem } from '@lobehub/ui/base-ui';
import { Avatar, Button, DropdownMenu, Skeleton, toast } from '@lobehub/ui/base-ui';
import { LogOutIcon, UserCircleIcon, UserIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCommunityWorkspaceProfile } from '@/business/client/hooks/useCommunityWorkspaceProfile';
import { openMarketAccountRecoveryModal } from '@/features/MarketAccountRecoveryModal';
import { isMarketAuthorizationDenied } from '@/features/MarketAccountRecoveryModal/errors';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useMarketAuth, useMarketUserProfile } from '@/layout/AuthProvider/MarketAuth';
import { useServerConfigStore } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';

import { resolveCommunityUserAvatarTarget } from './navigation';

interface UserAvatarProps {
  avatarOverride?: string | null;
}

/**
 * Check whether the user needs to complete their profile
 * When using trustedClient auto-authorization, the user's meta-related fields will be empty
 */
const checkNeedsProfileSetup = (
  enableMarketTrustedClient: boolean,
  userProfile:
    | {
        avatarUrl: string | null;
        bannerUrl: string | null;
        socialLinks: { github?: string; twitter?: string; website?: string } | null;
      }
    | null
    | undefined,
): boolean => {
  if (!enableMarketTrustedClient) return false;
  if (!userProfile) return true;

  // If the avatarUrl field is empty, the user needs to complete their profile
  const hasAvatarUrl = !!userProfile.avatarUrl;

  return !hasAvatarUrl;
};

const UserAvatar = memo<UserAvatarProps>(({ avatarOverride }) => {
  const { t } = useTranslation('discover');
  const navigate = useWorkspaceAwareNavigate();
  const [loading, setLoading] = useState(false);
  const [authorizationDenied, setAuthorizationDenied] = useState(false);
  const {
    avatarUrl: workspaceAvatarUrl,
    isWorkspaceScope,
    username: workspaceUsername,
  } = useCommunityWorkspaceProfile();
  const { isAuthenticated, isLoading, getCurrentUserInfo, signIn, signOut } = useMarketAuth();

  const enableMarketTrustedClient = useServerConfigStore(
    serverConfigSelectors.enableMarketTrustedClient,
  );

  const userInfo = getCurrentUserInfo();
  const username = userInfo?.sub;

  // Use SWR to fetch user profile with caching
  const { data: userProfile } = useMarketUserProfile(username);

  // Check whether profile setup is needed
  const needsProfileSetup = checkNeedsProfileSetup(enableMarketTrustedClient, userProfile);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    setAuthorizationDenied(false);
    try {
      // Unified call to signIn, which shows a confirmation dialog first
      // In trustedClient mode, confirmation opens the ProfileSetupModal
      // In OIDC mode, confirmation triggers the OIDC flow
      await signIn();
    } catch (error) {
      setAuthorizationDenied(isMarketAuthorizationDenied(error));
    }
    setLoading(false);
  }, [signIn]);

  const handleAvatarClick = useCallback(() => {
    const profileUserName = userProfile?.userName || userProfile?.namespace;
    const target = resolveCommunityUserAvatarTarget({
      isWorkspaceScope,
      profileUsername: profileUserName,
    });

    if (target) {
      navigate(target);
    }
  }, [isWorkspaceScope, navigate, userProfile?.userName, userProfile?.namespace]);

  const handleSwitchAccount = useCallback(() => {
    openMarketAccountRecoveryModal(handleSignIn);
  }, [handleSignIn]);

  const handleSignOut = useCallback(async () => {
    try {
      await toast.promise(signOut(), {
        error: t('user.logout.error'),
        loading: t('user.logout.loading'),
        success: t('user.logout.success'),
      });
    } catch (error) {
      console.error('[Community] Failed to sign out:', error);
    }
  }, [signOut, t]);

  const menuItems = useMemo<DropdownItem[]>(
    () => [
      {
        disabled: !isWorkspaceScope && !userProfile?.userName && !userProfile?.namespace,
        icon: <UserIcon size={16} />,
        key: 'profile',
        label: t('user.myProfile'),
        onClick: handleAvatarClick,
      },
      {
        danger: true,
        icon: <LogOutIcon size={16} />,
        key: 'logout',
        label: t('user.logout'),
        onClick: handleSignOut,
      },
    ],
    [
      handleAvatarClick,
      handleSignOut,
      isWorkspaceScope,
      t,
      userProfile?.namespace,
      userProfile?.userName,
    ],
  );

  if (isLoading) {
    return <Skeleton.Avatar shape={'square'} size={28} style={{ borderRadius: 6 }} />;
  }

  // If trustedClient is enabled, skip the "become a creator" button and show the avatar directly
  // Otherwise, show the login button when unauthenticated or profile setup is needed
  if (!enableMarketTrustedClient && (!isAuthenticated || needsProfileSetup)) {
    return (
      <Flexbox horizontal align={'center'} gap={4}>
        <Button
          icon={UserCircleIcon}
          loading={loading}
          type="text"
          style={{
            height: 30,
          }}
          onClick={handleSignIn}
        >
          {t('user.login')}
        </Button>
        {authorizationDenied && (
          <Button size={'small'} type={'text'} onClick={handleSwitchAccount}>
            {t('user.switchAccount')}
          </Button>
        )}
      </Flexbox>
    );
  }

  // Get avatar from user profile (fetched via SWR with caching)
  const avatarUrl =
    avatarOverride ||
    (isWorkspaceScope
      ? workspaceAvatarUrl || workspaceUsername
      : userProfile?.avatarUrl || userProfile?.userName || username);

  if (enableMarketTrustedClient) {
    return <Avatar avatar={avatarUrl} shape={'square'} size={28} onClick={handleAvatarClick} />;
  }

  return (
    <DropdownMenu items={menuItems} placement={'bottomRight'}>
      <Button
        aria-label={t('user.accountMenu')}
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
        type={'text'}
      >
        <Avatar avatar={avatarUrl} shape={'square'} size={28} />
      </Button>
    </DropdownMenu>
  );
});

export default UserAvatar;
