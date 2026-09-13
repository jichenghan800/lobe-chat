import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ModelDisplayOption } from '@/types/modelDisplay';

const toOptionLabel = (provider: string, model: string, displayName?: string) => {
  if (displayName && displayName !== model) return `${displayName} (${provider}/${model})`;

  return `${provider}/${model}`;
};

export const getDeployedModelOptions = async () => {
  const { aiProvider } = await getServerGlobalConfig();
  const options: ModelDisplayOption[] = [];

  for (const [provider, config] of Object.entries(aiProvider)) {
    if (!config?.enabled) continue;

    for (const model of config.serverModelLists || []) {
      if (model.type && model.type !== 'chat') continue;

      options.push({
        displayName: model.displayName,
        label: toOptionLabel(provider, model.id, model.displayName),
        model: model.id,
        provider,
      });
    }
  }

  const seen = new Set<string>();

  return options
    .filter((item) => {
      const key = `${item.provider.toLowerCase()}/${item.model.toLowerCase()}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};
