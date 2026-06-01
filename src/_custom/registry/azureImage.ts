const TARGET_PROVIDER = 'azure';
const TARGET_MODEL = 'gpt-image-2';

interface ResolveAzureImageRuntimeInput {
  model: string;
  provider: string;
}

interface AzureImageRuntimeOverride {
  modelId: string;
  runtimeParams?: {
    apiKey?: string;
    apiVersion?: string;
    baseURL?: string;
  };
}

const cleanEnv = (value?: string) => {
  const text = value?.trim();

  return text || undefined;
};

export const resolveAzureImageRuntime = ({
  model,
  provider,
}: ResolveAzureImageRuntimeInput): AzureImageRuntimeOverride => {
  if (provider !== TARGET_PROVIDER || model !== TARGET_MODEL) return { modelId: model };

  const apiKey = cleanEnv(process.env.AZURE_IMAGE_API_KEY);
  const baseURL = cleanEnv(process.env.AZURE_IMAGE_BASE_URL);
  const apiVersion = cleanEnv(process.env.AZURE_IMAGE_API_VERSION);
  const modelId = cleanEnv(process.env.AZURE_IMAGE_MODEL_ID) || model;
  const runtimeParams = {
    ...(apiKey ? { apiKey } : {}),
    ...(apiVersion ? { apiVersion } : {}),
    ...(baseURL ? { baseURL } : {}),
  };

  return {
    modelId,
    ...(Object.keys(runtimeParams).length > 0 ? { runtimeParams } : {}),
  };
};
