import { useClientDataSWR } from '@/libs/swr';
import { cottiHomeNotificationService } from '@/services/cottiHomeNotification';

export const COTTI_HOME_NOTIFICATION_KEY = ['cotti', 'home-notification'] as const;

export const useCottiHomeNotification = (enabled = true) =>
  useClientDataSWR(
    enabled ? COTTI_HOME_NOTIFICATION_KEY : null,
    () => cottiHomeNotificationService.getConfig(),
    { revalidateOnFocus: false },
  );
