import vertexaiModels from 'model-bank/vertexai';

import { ModelProviderCard } from '@/types/llm';

const presetModels = vertexaiModels.map((model) => ({
  contextWindowTokens: model.contextWindowTokens,
  description: model.description,
  displayName: model.displayName,
  enabled: model.enabled,
  functionCall: model.abilities?.functionCall,
  id: model.id,
  maxOutput: model.maxOutput,
  parameters: model.parameters,
  pricing: model.pricing,
  reasoning: model.abilities?.reasoning,
  releasedAt: model.releasedAt,
  type: model.type,
  vision: model.abilities?.vision,
}));

// ref: https://ai.google.dev/gemini-api/docs/models/gemini
const VertexAI: ModelProviderCard = {
  chatModels: presetModels,
  checkModel: 'gemini-1.5-flash-002',
  description:
    'Google 的 Gemini 系列是其最先进、通用的 AI模型，由 Google DeepMind 打造，专为多模态设计，支持文本、代码、图像、音频和视频的无缝理解与处理。适用于从数据中心到移动设备的多种环境，极大提升了AI模型的效率与应用广泛性。',
  id: 'vertexai',
  modelsUrl: 'https://console.cloud.google.com/vertex-ai/model-garden',
  name: 'Vertex AI',
  settings: {
    disableBrowserRequest: true,
    responseAnimation: 'smooth',
    sdkType: 'google',
    showModelFetcher: false,
  },
  url: 'https://cloud.google.com/vertex-ai',
};

export default VertexAI;
