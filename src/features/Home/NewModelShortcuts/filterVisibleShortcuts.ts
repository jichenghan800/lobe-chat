import type { HomeNewModelItem } from '@/business/client/hooks/useHomeNewModels';
import type { ModelDisplayConfig } from '@/types/modelDisplay';

interface AvailableModel {
  displayName?: string;
  id: string;
  providerId: string;
  type: string;
}

/** Match provider as well as model: deployment on another provider does not make a shortcut usable. */
export const filterVisibleShortcuts = (
  items: HomeNewModelItem[],
  models: AvailableModel[],
  config: ModelDisplayConfig | undefined,
  fallbackProvider: string,
): HomeNewModelItem[] =>
  items.flatMap((item) => {
    if (item.type === 'video') return [];
    const provider = item.provider ?? (item.type === 'chat' ? fallbackProvider : undefined);
    const model = models.find(
      (candidate) =>
        candidate.id === item.model &&
        candidate.type === item.type &&
        (!provider || candidate.providerId === provider),
    );
    if (!model) return [];
    if (item.type !== 'chat') return [item];
    const display = config?.chat.find(
      (candidate) =>
        candidate.enabled &&
        candidate.model === item.model &&
        candidate.provider === model.providerId,
    );
    if (!display) return [];
    return [{ ...item, title: display.displayName?.trim() || model.displayName || item.title }];
  });
