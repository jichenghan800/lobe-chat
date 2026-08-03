import type { AiProviderModelListItem, AiProviderRuntimeState } from 'model-bank';

import { getEnabledModelDisplayItems } from '@/database/models/cottiModelDisplay';
import {
  getUserScopedAiProviderModelList,
  getUserScopedAiProviderRuntimeState,
} from '@/server/services/aiProviderAccess';
import type { ModelDisplayConfig, ModelDisplayItem } from '@/types/modelDisplay';
import { filterEnabledProvidersByModelType } from '@/utils/aiProvider';

interface AiProviderModelListOptions {
  enabled?: boolean;
  limit?: number;
  offset?: number;
  type?: string;
}

interface DisplayableModel {
  displayName?: string;
  id: string;
  type: string;
}

type LoadModelDisplayConfig = () => Promise<ModelDisplayConfig>;

const normalizeModelKey = (provider: string, model: string) =>
  `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`;

const createEnabledModelDisplayMap = (config: ModelDisplayConfig) =>
  new Map(
    getEnabledModelDisplayItems(config).map((item) => [
      normalizeModelKey(item.provider, item.model),
      item,
    ]),
  );

const applyModelDisplayItem = <T extends DisplayableModel>(
  providerId: string,
  model: T,
  displayItems: ReadonlyMap<string, ModelDisplayItem>,
): T | undefined => {
  if (model.type !== 'chat') return model;

  const displayItem = displayItems.get(normalizeModelKey(providerId, model.id));
  if (!displayItem) return;

  const displayName = displayItem.displayName?.trim();
  return displayName ? { ...model, displayName } : model;
};

const applyPagination = <T>(items: T[], options: AiProviderModelListOptions) => {
  const offset = Math.max(0, options.offset ?? 0);

  if (typeof options.limit === 'number') {
    return items.slice(offset, offset + Math.max(0, options.limit));
  }

  return offset > 0 ? items.slice(offset) : items;
};

export const getCottiScopedAiProviderModelList = async (
  userId: string,
  providerId: string,
  options: AiProviderModelListOptions,
  loadModelList: (options: AiProviderModelListOptions) => Promise<AiProviderModelListItem[]>,
  loadModelDisplayConfig: LoadModelDisplayConfig,
): Promise<AiProviderModelListItem[]> => {
  const [config, models] = await Promise.all([
    loadModelDisplayConfig(),
    getUserScopedAiProviderModelList(
      userId,
      providerId,
      { ...options, limit: undefined, offset: undefined },
      loadModelList,
    ),
  ]);
  const displayItems = createEnabledModelDisplayMap(config);
  const visibleModels = models
    .map((model) => applyModelDisplayItem(providerId, model, displayItems))
    .filter((model): model is AiProviderModelListItem => model !== undefined);

  return applyPagination(visibleModels, options);
};

export const getCottiScopedAiProviderRuntimeState = async (
  userId: string,
  loadRuntimeState: () => Promise<AiProviderRuntimeState>,
  loadModelDisplayConfig: LoadModelDisplayConfig,
): Promise<AiProviderRuntimeState> => {
  const [config, runtimeState] = await Promise.all([
    loadModelDisplayConfig(),
    getUserScopedAiProviderRuntimeState(userId, loadRuntimeState),
  ]);
  const displayItems = createEnabledModelDisplayMap(config);
  const enabledAiModels = runtimeState.enabledAiModels
    .map((model) => applyModelDisplayItem(model.providerId, model, displayItems))
    .filter(
      (model): model is AiProviderRuntimeState['enabledAiModels'][number] => model !== undefined,
    );

  return {
    ...runtimeState,
    enabledAiModels,
    enabledChatAiProviders: filterEnabledProvidersByModelType(
      runtimeState.enabledChatAiProviders,
      enabledAiModels,
      'chat',
    ),
    enabledImageAiProviders: filterEnabledProvidersByModelType(
      runtimeState.enabledImageAiProviders,
      enabledAiModels,
      'image',
    ),
    enabledVideoAiProviders: filterEnabledProvidersByModelType(
      runtimeState.enabledVideoAiProviders,
      enabledAiModels,
      'video',
    ),
  };
};
