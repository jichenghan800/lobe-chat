import { afterEach, describe, expect, it } from 'vitest';

import { resolveAzureImageRuntime } from './azureImage';

const ORIGINAL_ENV = { ...process.env };

describe('resolveAzureImageRuntime', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should not override non-target Azure image models', () => {
    process.env.AZURE_IMAGE_API_KEY = 'image-key';

    expect(resolveAzureImageRuntime({ model: 'gpt-image-1', provider: 'azure' })).toEqual({
      modelId: 'gpt-image-1',
    });
  });

  it('should resolve dedicated Azure image runtime params for gpt-image-2', () => {
    process.env.AZURE_IMAGE_API_KEY = 'image-key';
    process.env.AZURE_IMAGE_API_VERSION = '2025-04-01-preview';
    process.env.AZURE_IMAGE_BASE_URL = 'https://azure.example.com';
    process.env.AZURE_IMAGE_MODEL_ID = 'prod-gpt-image-2';

    expect(resolveAzureImageRuntime({ model: 'gpt-image-2', provider: 'azure' })).toEqual({
      modelId: 'prod-gpt-image-2',
      runtimeParams: {
        apiKey: 'image-key',
        apiVersion: '2025-04-01-preview',
        baseURL: 'https://azure.example.com',
      },
    });
  });
});
