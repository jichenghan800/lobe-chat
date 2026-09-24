import { useCottiPlatformAdminAccess } from '@/features/CottiPlatformAnalytics/hooks';
import { isForbiddenError } from '@/utils/forbiddenError';

import { canShowCottiManagedSettings } from './managedSettings';

/** UI policy only; API permissions and ownership checks remain native. */
export const useManagedSettingsAccess = () => {
  const { enabled, swr } = useCottiPlatformAdminAccess({ suspense: false });

  // The existing admin probe deliberately returns 403 for ordinary users.
  const denied = enabled && isForbiddenError(swr.error);

  return {
    canManage: !denied && canShowCottiManagedSettings(enabled, swr.data?.isAdmin),
    data: enabled ? (denied ? false : swr.data) : true,
    error: enabled && !denied ? swr.error : undefined,
    isLoading: enabled && !swr.data && !swr.error,
    retry: swr.mutate,
  };
};
