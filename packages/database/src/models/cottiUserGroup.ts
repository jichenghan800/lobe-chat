import { eq } from 'drizzle-orm';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { cottiUserGroups, cottiUserPolicies } from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export class CottiUserGroupModel {
  constructor(private db: LobeChatDatabase | Transaction) {}

  list = () => this.db.select().from(cottiUserGroups).orderBy(cottiUserGroups.name);

  async resolve(userId?: string) {
    const groups = await this.list();
    if (!userId) return { group: undefined, reservedProviders: groups.map((g) => g.provider) };
    const [policy] = await this.db
      .select({ groupId: cottiUserPolicies.groupId })
      .from(cottiUserPolicies)
      .where(eq(cottiUserPolicies.userId, userId))
      .limit(1);
    const group = groups.find((g) => g.id === policy?.groupId);
    if (policy?.groupId && !group) throw new Error('User group configuration is missing');
    return { group, reservedProviders: groups.map((g) => g.provider) };
  }

  async modelDisplay(config: ModelDisplayConfig, userId?: string): Promise<ModelDisplayConfig> {
    const { group, reservedProviders } = await this.resolve(userId);
    if (group)
      return {
        ...(group.enabled ? group.modelDisplay : { agent: [], chat: [] }),
        allowedProvider: group.provider,
        allowedImageModels: group.enabled ? group.imageModels : [],
      };
    const allowed = (provider: string) => !reservedProviders.includes(provider);
    return {
      ...config,
      excludedProviders: reservedProviders,
      chat: config.chat.filter((m) => allowed(m.provider)),
      agent: config.agent.filter((m) => allowed(m.provider)),
      defaults: {
        chat:
          config.defaults?.chat && allowed(config.defaults.chat.provider)
            ? config.defaults.chat
            : undefined,
        agent:
          config.defaults?.agent && allowed(config.defaults.agent.provider)
            ? config.defaults.agent
            : undefined,
      },
    };
  }

  async allows(userId: string, provider: string, model: string) {
    const { group, reservedProviders } = await this.resolve(userId);
    if (!group) return !reservedProviders.includes(provider);
    if (!group.enabled || group.provider !== provider) return false;
    return (
      group.imageModels.includes(model) ||
      [...group.modelDisplay.chat, ...group.modelDisplay.agent].some(
        (m) => m.enabled && m.provider === provider && m.model === model,
      )
    );
  }
}
