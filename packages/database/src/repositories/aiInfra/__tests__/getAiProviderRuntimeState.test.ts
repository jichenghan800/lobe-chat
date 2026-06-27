import type { AiProviderRuntimeConfig, EnabledProvider, ProviderConfig } from '@lobechat/types';
import type { EnabledAiModel } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '../../../type';
import { AiInfraRepos } from '../index';

const userId = 'test-user-id';
const mockProviderConfigs = {
  openai: { enabled: true },
  anthropic: { enabled: false },
  fal: {
    enabled: true,
    serverModelLists: [
      { id: 'flux/schnell', providerId: 'fal', type: 'image' },
      { id: 'flux-kontext/dev', providerId: 'fal', type: 'image' },
    ],
  },
  vertexai: {
    enabled: true,
    serverModelLists: [
      { id: 'gemini-3.1-flash-lite', providerId: 'vertexai', type: 'chat' },
      { id: 'gemini-3.5-flash', providerId: 'vertexai', type: 'chat' },
    ],
  },
} as unknown as Record<string, ProviderConfig>;

let repo: AiInfraRepos;

beforeEach(() => {
  vi.clearAllMocks();
  repo = new AiInfraRepos({} as LobeChatDatabase, userId, mockProviderConfigs);
});

describe('AiInfraRepos', () => {
  describe('getAiProviderRuntimeState', () => {
    it('should return complete runtime state', async () => {
      const mockRuntimeConfig = {
        vertexai: { apiKey: 'test-key' },
      } as unknown as Record<string, AiProviderRuntimeConfig>;
      const mockEnabledProviders = [{ id: 'vertexai', name: 'Vertex AI' }] as EnabledProvider[];
      const mockEnabledModels = [
        {
          abilities: {},
          enabled: true,
          id: 'gemini-3.1-flash-lite',
          providerId: 'vertexai',
          type: 'chat',
        },
      ] as EnabledAiModel[];

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue(mockEnabledProviders);
      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue(mockEnabledModels);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toMatchObject({
        enabledAiProviders: mockEnabledProviders,
        enabledAiModels: mockEnabledModels,
        runtimeConfig: expect.any(Object),
      });
    });

    it('should return provider runtime state', async () => {
      const mockRuntimeConfig = {
        vertexai: {
          apiKey: 'test-key',
        },
      } as unknown as Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
        { id: 'vertexai', logo: 'logo2', name: 'Vertex AI', source: 'builtin' },
      ]);

      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue([
        {
          abilities: {},
          enabled: true,
          id: 'gpt-4',
          providerId: 'openai',
          type: 'chat',
        },
        {
          abilities: {},
          enabled: true,
          id: 'gemini-3.1-flash-lite',
          providerId: 'vertexai',
          type: 'chat',
        },
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gemini-3.1-flash-lite',
            providerId: 'vertexai',
          }),
        ],
        enabledAiProviders: [
          { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
          { id: 'vertexai', logo: 'logo2', name: 'Vertex AI', source: 'builtin' },
        ],
        enabledChatAiProviders: [
          { id: 'vertexai', logo: 'logo2', name: 'Vertex AI', source: 'builtin' },
        ],
        enabledImageAiProviders: [],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          vertexai: expect.objectContaining({
            apiKey: 'test-key',
            enabled: true,
          }),
        },
      });
    });

    it('should return provider runtime state with enabledImageAiProviders', async () => {
      const mockRuntimeConfig = {
        fal: {
          apiKey: 'test-fal-key',
        },
        vertexai: {
          apiKey: 'test-vertexai-key',
        },
      } as unknown as Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      // Mock providers including fal for image generation
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
        { id: 'vertexai', logo: 'vertexai-logo', name: 'Vertex AI', source: 'builtin' },
      ]);

      // Mock models including image models from fal
      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue([
        {
          abilities: {},
          enabled: true,
          id: 'gemini-3.1-flash-lite',
          providerId: 'vertexai',
          type: 'chat',
        },
        {
          abilities: {},
          enabled: true,
          id: 'flux/schnell',
          providerId: 'fal',
          type: 'image',
        },
        {
          abilities: {},
          enabled: true,
          id: 'flux-kontext/dev',
          providerId: 'fal',
          type: 'image',
        },
        {
          abilities: {},
          enabled: true,
          id: 'flux-pro/v1.1',
          providerId: 'fal',
          type: 'image',
        },
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gemini-3.1-flash-lite',
            providerId: 'vertexai',
            type: 'chat',
          }),
          expect.objectContaining({
            enabled: true,
            id: 'flux/schnell',
            providerId: 'fal',
            type: 'image',
          }),
          expect.objectContaining({
            enabled: true,
            id: 'flux-kontext/dev',
            providerId: 'fal',
            type: 'image',
          }),
        ],
        enabledAiProviders: [
          { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
          { id: 'vertexai', logo: 'vertexai-logo', name: 'Vertex AI', source: 'builtin' },
        ],
        enabledChatAiProviders: [
          { id: 'vertexai', logo: 'vertexai-logo', name: 'Vertex AI', source: 'builtin' },
        ],
        enabledImageAiProviders: [
          expect.objectContaining({
            id: 'fal',
            name: 'Fal',
          }),
        ],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          fal: expect.objectContaining({
            apiKey: 'test-fal-key',
            enabled: true,
          }),
          vertexai: expect.objectContaining({
            apiKey: 'test-vertexai-key',
            enabled: true,
          }),
        },
      });

      expect(result.enabledAiModels).not.toContainEqual(
        expect.objectContaining({ id: 'flux-pro/v1.1', providerId: 'fal' }),
      );
    });
  });
});
