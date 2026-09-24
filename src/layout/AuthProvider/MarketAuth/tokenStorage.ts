import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/slices/settings/selectors/settings';

/**
 * Clear market tokens from DB
 */
export const clearMarketTokensFromDB = async (options: { throwOnError?: boolean } = {}) => {
  // If there are no tokens, no need to call setSettings
  const currentTokens = settingsSelectors.currentSettings(useUserStore.getState()).market;
  if (!currentTokens?.accessToken && !currentTokens?.refreshToken && !currentTokens?.expiresAt) {
    return;
  }

  try {
    await useUserStore.getState().setSettings({
      market: null,
    });
  } catch (error) {
    console.error('[MarketAuth] Failed to clear tokens from DB:', error);
    if (options.throwOnError) {
      // setSettings is optimistic. A failed clear must remain retryable; do not
      // overwrite newer credentials adopted by a concurrent refresh.
      useUserStore.setState((state) =>
        state.settings.market === null
          ? { settings: { ...state.settings, market: currentTokens } }
          : {},
      );
      throw error;
    }
  }
};
