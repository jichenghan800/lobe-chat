import type { ModelDisplayConfig } from '@/types/modelDisplay';

const models = [
  { model: 'gemini-3.5-flash-lite', displayName: 'COTTI-快速' },
  { model: 'gemini-3.8-flash', displayName: 'COTTI-专业' },
  { model: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra' },
  { model: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol' },
].map((model) => ({ ...model, provider: 'openai', enabled: true }));

/** Initial administrator-approved group; contains no credentials or member assignments. */
export const ASTRAFLOW_PRESSURE_GROUP = {
  id: 'astraflow-pressure',
  name: '压测组',
  provider: 'openai',
  enabled: true,
  fastModel: 'gemini-3.5-flash-lite',
  imageModels: ['gpt-image-2.5-flare'],
  modelDisplay: {
    chat: models,
    agent: models,
    defaults: {
      chat: { provider: 'openai', model: 'gemini-3.5-flash-lite' },
      agent: { provider: 'openai', model: 'gemini-3.8-flash' },
    },
  } satisfies ModelDisplayConfig,
};
