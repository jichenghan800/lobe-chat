import type { ReactNode } from 'react';

import { useCottiHomeNotification } from '@/_custom/hooks/useCottiHomeNotification';
import { resolveCottiHomeNotificationContent } from '@/_custom/registry/homeNotification';

/**
 * The promo the home portrait speaks. Returning a node (rather than rendering
 * one) is what lets the caller know a promo is live, so it can hold back the
 * daily brief — and hand the brief back the moment the promo is dismissed.
 */
export const useHomePromoLine = (): ReactNode | undefined => {
  const { data } = useCottiHomeNotification();

  return resolveCottiHomeNotificationContent(data);
};
