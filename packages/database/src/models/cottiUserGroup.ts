import { eq, sql } from 'drizzle-orm';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { cottiUserGroups, cottiUserPolicies } from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export class CottiUserGroupModel {
  constructor(private db: LobeChatDatabase | Transaction) {}

  list = () => this.db.select().from(cottiUserGroups).orderBy(cottiUserGroups.name);

  async get(id: string) {
    const [group] = await this.db.select().from(cottiUserGroups).where(eq(cottiUserGroups.id, id));
    if (!group) throw new Error('User group not found');
    return group;
  }

  async updateConfig(id: string, config: ModelDisplayConfig, actor: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM cotti_user_groups WHERE id = ${id} FOR UPDATE`);
      const group = await new CottiUserGroupModel(tx).get(id);
      if ([...config.chat, ...config.agent].some((r) => r.provider !== group.provider))
        throw new Error('Models must use the user group channel');
      for (const scope of ['chat', 'agent'] as const) {
        if (
          group.modelDisplay[scope].some(
            (old) =>
              old.enabled &&
              !config[scope].some(
                (r) => r.enabled && r.model === old.model && r.provider === old.provider,
              ),
          )
        )
          throw new Error('Retire models through the replacement and migration action');
      }
      if (
        group.modelDisplay.retirements?.some((retired) =>
          [...config.chat, ...config.agent].some(
            (r) =>
              r.enabled &&
              r.model === retired.source.model &&
              r.provider === retired.source.provider,
          ),
        )
      )
        throw new Error('Retired models cannot be enabled');
      const next = { ...config, retirements: group.modelDisplay.retirements };
      await tx
        .update(cottiUserGroups)
        .set({ modelDisplay: next, updatedBy: actor, updatedAt: new Date() })
        .where(eq(cottiUserGroups.id, id));
      return next;
    });
  }

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
