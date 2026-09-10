import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';

const COTTI_MODEL_DISPLAY_CONFIG_KEY = ['cotti', 'model-display-config'] as const;

export const useCottiModelDisplayConfig = (enabled = true) =>
  useClientDataSWR(
    enabled ? COTTI_MODEL_DISPLAY_CONFIG_KEY : null,
    () => cottiModelDisplayService.getConfig(),
    { revalidateOnFocus: true },
  );
