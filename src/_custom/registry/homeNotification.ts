import type { CottiHomeNotificationConfig } from '@/types/cotti/homeNotification';

export const resolveCottiHomeNotificationContent = (
  config: CottiHomeNotificationConfig | undefined,
) => (config?.enabled && config.content.trim() ? config.content.trim() : undefined);
