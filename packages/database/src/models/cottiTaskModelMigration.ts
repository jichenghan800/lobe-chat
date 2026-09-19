import { createHash } from 'node:crypto';

import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';

import type { ModelDisplayConfig, ModelDisplayModelRef } from '@/types/modelDisplay';

import {
  agents,
  cottiModelDisplaySettings,
  cottiUserGroups,
  cottiUserPolicies,
  tasks,
  topics,
} from '../schemas';
import type { LobeChatDatabase } from '../type';
import { CottiModelDisplayModel, normalizeModelDisplayConfig } from './cottiModelDisplay';
import { CottiUserGroupModel } from './cottiUserGroup';

const key = (ref: ModelDisplayModelRef) =>
  `${ref.provider.trim().toLowerCase()}/${ref.model.trim().toLowerCase()}`;
const topicMatches = (ref: ModelDisplayModelRef) =>
  and(
    sql`lower(trim(${topics.model})) = ${ref.model.trim().toLowerCase()}`,
    sql`lower(trim(${topics.provider})) = ${ref.provider.trim().toLowerCase()}`,
  );
const same = (a: ModelDisplayModelRef, b: ModelDisplayModelRef) => key(a) === key(b);

// Mirror the runner: if either snapshot field is missing it snapshots BOTH from the Agent.
const snapshotPresent = sql`jsonb_typeof(${tasks.config}->'model') = 'string' AND jsonb_typeof(${tasks.config}->'provider') = 'string'`;
const matches = (ref: ModelDisplayModelRef) =>
  and(
    sql`${tasks.isDeleted} IS NOT TRUE`,
    sql`${tasks.status} NOT IN ('completed', 'failed', 'canceled')`,
    sql`lower(trim(CASE WHEN ${snapshotPresent} THEN ${tasks.config}->>'model' ELSE ${agents.model} END)) = ${ref.model.trim().toLowerCase()}`,
    sql`lower(trim(CASE WHEN ${snapshotPresent} THEN ${tasks.config}->>'provider' ELSE ${agents.provider} END)) = ${ref.provider.trim().toLowerCase()}`,
  );

export class CottiTaskModelMigrationError extends Error {}

export class CottiTaskModelMigrationModel {
  constructor(
    private db: LobeChatDatabase,
    private groupId?: string,
  ) {}

  private memberScope = (owner: SQLWrapper) =>
    this.groupId
      ? sql`${owner} IN (SELECT ${cottiUserPolicies.userId} FROM ${cottiUserPolicies} WHERE ${cottiUserPolicies.groupId} = ${this.groupId})`
      : undefined;

  private getConfig = async () =>
    this.groupId
      ? (await new CottiUserGroupModel(this.db).get(this.groupId)).modelDisplay
      : new CottiModelDisplayModel(this.db).getConfig();

  private rows = (source: ModelDisplayModelRef) =>
    this.db
      .select({
        id: tasks.id,
        identifier: tasks.identifier,
        name: tasks.name,
        status: tasks.status,
        updatedAt: tasks.updatedAt,
        ownerId: tasks.createdByUserId,
        workspaceId: tasks.workspaceId,
      })
      .from(tasks)
      .leftJoin(agents, eq(tasks.assigneeAgentId, agents.id))
      .where(and(matches(source), this.memberScope(tasks.createdByUserId)))
      .orderBy(tasks.id);

  preview = async (source: ModelDisplayModelRef) => {
    const groups = new CottiUserGroupModel(this.db);
    if (this.groupId) {
      if ((await groups.get(this.groupId)).provider !== source.provider)
        throw new CottiTaskModelMigrationError('只能管理本组渠道的模型');
    } else if ((await groups.list()).some((g) => g.provider === source.provider)) {
      throw new CottiTaskModelMigrationError('专属渠道模型请在对应用户组页签下线');
    }
    const [rows, config, agentRows, topicRows] = await Promise.all([
      this.rows(source),
      this.getConfig(),
      this.db
        .select({ id: agents.id, updatedAt: agents.updatedAt })
        .from(agents)
        .where(
          and(
            this.memberScope(agents.userId),
            sql`lower(trim(${agents.model})) = ${source.model.trim().toLowerCase()}`,
            sql`lower(trim(${agents.provider})) = ${source.provider.trim().toLowerCase()}`,
          ),
        )
        .orderBy(agents.id),
      this.db
        .select({ id: topics.id, updatedAt: topics.updatedAt })
        .from(topics)
        .where(and(topicMatches(source), this.memberScope(topics.userId)))
        .orderBy(topics.id),
    ]);
    const revision = createHash('sha256')
      .update(
        JSON.stringify({
          groupId: this.groupId,
          source: key(source),
          rows,
          config,
          agentRows,
          topicRows,
        }),
      )
      .digest('hex');
    return {
      revision,
      taskCount: rows.length,
      runningCount: rows.filter((r) => r.status === 'running').length,
      agentCount: agentRows.length,
      topicCount: topicRows.length,
      tasks: rows.slice(0, 100),
      source,
    };
  };

  migrate = async (
    source: ModelDisplayModelRef,
    target: ModelDisplayModelRef,
    revision: string,
    actor: string,
  ) => {
    if (same(source, target)) throw new CottiTaskModelMigrationError('替代模型不能与原模型相同');
    return this.db.transaction(async (tx) => {
      // Serialize configuration changes and task edits/creation during the reviewed batch.
      // No external I/O occurs while these locks are held.
      await tx.execute(
        sql`LOCK TABLE cotti_model_display_settings, cotti_user_groups, cotti_user_policies, tasks, agents, topics IN SHARE ROW EXCLUSIVE MODE`,
      );
      const scoped = new CottiTaskModelMigrationModel(tx as LobeChatDatabase, this.groupId);
      const preview = await scoped.preview(source);
      if (preview.revision !== revision)
        throw new CottiTaskModelMigrationError('任务或模型配置已变化，请重新预览后确认');
      const config = await scoped.getConfig();
      if (this.groupId) {
        const group = await new CottiUserGroupModel(tx).get(this.groupId);
        if (source.provider !== group.provider || target.provider !== group.provider)
          throw new CottiTaskModelMigrationError('替换模型必须使用本组渠道');
      }
      if (
        config.retirements?.some((r) => same(r.source, target)) ||
        !config.agent.some((r) => r.enabled && same(r, target)) ||
        !config.chat.some((r) => r.enabled && same(r, target))
      )
        throw new CottiTaskModelMigrationError(
          '替代模型必须同时在 Chat 和 Agent 模型列表中启用，且未全局下线',
        );
      const next: ModelDisplayConfig = structuredClone(config);
      for (const scope of ['agent', 'chat'] as const) {
        next[scope] = next[scope].map((r) => (same(r, source) ? { ...r, enabled: false } : r));
        if (!next[scope].some((r) => r.enabled))
          throw new CottiTaskModelMigrationError('每种模式至少保留一个启用模型');
        if (next.defaults?.[scope] && same(next.defaults[scope]!, source)) {
          if (!next[scope].some((r) => r.enabled && same(r, target)))
            throw new CottiTaskModelMigrationError(
              '替代模型还需在原默认模型对应的列表中启用，或先调整默认模型',
            );
          next.defaults[scope] = target;
        }
      }
      const at = new Date();
      const ids = tx
        .select({ id: tasks.id })
        .from(tasks)
        .leftJoin(agents, eq(tasks.assigneeAgentId, agents.id))
        .where(and(matches(source), this.memberScope(tasks.createdByUserId)));
      const audit = JSON.stringify({ at: at.toISOString(), by: actor, from: source, to: target });
      const changed = await tx
        .update(tasks)
        .set({
          config: sql`COALESCE(${tasks.config}, '{}'::jsonb) || jsonb_build_object('model', ${target.model}::text, 'provider', ${target.provider}::text,
          'cottiModelMigrations', COALESCE(${tasks.config}->'cottiModelMigrations', '[]'::jsonb) || ${audit}::jsonb)`,
          updatedAt: at,
        })
        .where(sql`${tasks.id} IN (${ids})`)
        .returning({ id: tasks.id });
      const changedAgents = await tx
        .update(agents)
        .set({ ...target, updatedAt: at })
        .where(
          and(
            this.memberScope(agents.userId),
            sql`lower(trim(${agents.model})) = ${source.model.trim().toLowerCase()}`,
            sql`lower(trim(${agents.provider})) = ${source.provider.trim().toLowerCase()}`,
          ),
        )
        .returning({ id: agents.id });
      const changedTopics = await tx
        .update(topics)
        .set({
          model: target.model,
          provider: target.provider,
          updatedAt: at,
        })
        .where(and(topicMatches(source), this.memberScope(topics.userId)))
        .returning({ id: topics.id });
      // Historical messages, summaries and usage aggregates remain unchanged.
      next.retirements = [
        ...(config.retirements || []).filter((r) => !same(r.source, source)),
        { source, target, by: actor, at: at.toISOString() },
      ];
      const normalized = normalizeModelDisplayConfig(next);
      if (this.groupId) {
        const group = await new CottiUserGroupModel(tx).get(this.groupId);
        await tx
          .update(cottiUserGroups)
          .set({
            modelDisplay: normalized,
            fastModel: group.fastModel === source.model ? target.model : group.fastModel,
            updatedBy: actor,
            updatedAt: at,
          })
          .where(eq(cottiUserGroups.id, this.groupId));
      } else
        await tx
          .insert(cottiModelDisplaySettings)
          .values({ id: 'default', config: normalized, updatedBy: actor })
          .onConflictDoUpdate({
            target: cottiModelDisplaySettings.id,
            set: { config: normalized, updatedBy: actor, updatedAt: at },
          });
      return {
        config: normalized,
        migratedCount: changed.length,
        agentCount: changedAgents.length,
        topicCount: changedTopics.length,
        at: at.toISOString(),
      };
    });
  };
}
