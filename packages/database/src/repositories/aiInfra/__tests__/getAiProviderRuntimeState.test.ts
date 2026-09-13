import type { AiProviderRuntimeConfig, EnabledProvider } from '@lobechat/types';
import type { EnabledAiModel } from 'model-bank';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../../../core/getTestDB';
import type { LobeChatDatabase } from '../../../type';
import { AiInfraRepos } from '../index';

const userId = 'test-user-id';
const mockProviderConfigs = {
  openai: { enabled: true },
  anthropic: { enabled: false },
};

let serverDB: LobeChatDatabase;
let repo: AiInfraRepos;

beforeAll(async () => {
  serverDB = await getTestDB();
}, 30000);

beforeEach(() => {
  vi.clearAllMocks();
  repo = new AiInfraRepos(serverDB, userId, mockProviderConfigs);
});

describe('AiInfraRepos', () => {
  describe('getAiProviderRuntimeState', () => {
    it.each(['chat', 'image', 'video', 'embedding'] as const)(
      'excludes %s models from disabled providers while preserving explicitly enabled providers',
      async (type) => {
        const providers: EnabledProvider[] = [
          { id: 'openai', source: 'builtin' },
          // Effective user configuration may enable a provider disabled by server defaults.
          { id: 'anthropic', source: 'builtin' },
        ];
        const models: EnabledAiModel[] = ['openai', 'anthropic', 'fal'].map((providerId) => ({
          abilities: {},
          enabled: true,
          id: 'shared-model',
          providerId,
          type,
        }));
        vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue({});
        vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue(providers);
        vi.spyOn(repo, 'getEnabledModels').mockResolvedValue(models);

        const result = await repo.getAiProviderRuntimeState();

        expect(result.enabledAiModels).toEqual(models.slice(0, 2));
        expect(result.enabledAiProviders).toEqual(providers);
        expect(models).toHaveLength(3);
      },
    );

    it('does not advertise a modality when its only model is disabled', async () => {
      const provider: EnabledProvider = { id: 'openai', source: 'builtin' };
      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue({});
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([provider]);
      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue(
        (['chat', 'image', 'video'] as const).map((type) => ({
          abilities: {},
          enabled: false,
          id: type,
          providerId: 'openai',
          type,
        })),
      );
      const result = await repo.getAiProviderRuntimeState();
      expect(result.enabledAiModels).toEqual([]);
      expect(result.enabledChatAiProviders).toEqual([]);
      expect(result.enabledImageAiProviders).toEqual([]);
      expect(result.enabledVideoAiProviders).toEqual([]);
      expect(result.enabledAiProviders).toEqual([provider]);
    });

    it('should return complete runtime state', async () => {
      const mockRuntimeConfig = {
        openai: { apiKey: 'test-key' },
      } as unknown as Record<string, AiProviderRuntimeConfig>;
      const mockEnabledProviders = [{ id: 'openai', name: 'OpenAI' }] as EnabledProvider[];
      const mockEnabledModels = [
        { id: 'gpt-4', providerId: 'openai', enabled: true },
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
        openai: {
          apiKey: 'test-key',
        },
      } as unknown as Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
      ]);

      vi.spyOn(repo, 'getEnabledModels').mockResolvedValue([
        {
          abilities: {},
          enabled: true,
          id: 'gpt-4',
          providerId: 'openai',
          type: 'chat',
        },
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gpt-4',
            providerId: 'openai',
          }),
        ],
        enabledAiProviders: [{ id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' }],
        enabledChatAiProviders: [
          { id: 'openai', logo: 'logo1', name: 'OpenAI', source: 'builtin' },
        ],
        enabledImageAiProviders: [],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          openai: {
            apiKey: 'test-key',
            enabled: true,
          },
        },
      });
    });

    it('should return provider runtime state with enabledImageAiProviders', async () => {
      const mockRuntimeConfig = {
        fal: {
          apiKey: 'test-fal-key',
        },
        openai: {
          apiKey: 'test-openai-key',
        },
      } as unknown as Record<string, AiProviderRuntimeConfig>;

      vi.spyOn(repo.aiProviderModel, 'getAiProviderRuntimeConfig').mockResolvedValue(
        mockRuntimeConfig,
      );

      // Mock providers including fal for image generation
      vi.spyOn(repo, 'getUserEnabledProviderList').mockResolvedValue([
        { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
        { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
      ]);

      // Mock models including image models from fal
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
      ]);

      const result = await repo.getAiProviderRuntimeState();

      expect(result).toEqual({
        enabledAiModels: [
          expect.objectContaining({
            enabled: true,
            id: 'gpt-4',
            providerId: 'openai',
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
          { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
          { id: 'fal', logo: 'fal-logo', name: 'Fal', source: 'builtin' },
        ],
        enabledChatAiProviders: [
          { id: 'openai', logo: 'openai-logo', name: 'OpenAI', source: 'builtin' },
        ],
        enabledImageAiProviders: [
          expect.objectContaining({
            id: 'fal',
            name: 'Fal',
          }),
        ],
        enabledVideoAiProviders: [],
        runtimeConfig: {
          fal: {
            apiKey: 'test-fal-key',
            enabled: undefined,
          },
          openai: {
            apiKey: 'test-openai-key',
            enabled: true,
          },
        },
      });
    });
  });
});
