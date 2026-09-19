import { sql } from 'drizzle-orm';

import type { LobeChatDatabase, Transaction } from '../type';

/** Only a raised effective limit can invalidate a budget freeze. Manual/context gates remain. */
export async function reconcileTopicBudgetFreezes(
  db: LobeChatDatabase | Transaction,
  scope: { topicId?: string; userId?: string } = {},
) {
  return db.execute(sql`
    WITH released AS (
      DELETE FROM topic_cost_freezes f USING topics t
      WHERE f.topic_id=t.id AND f.reason='budget'
        AND (${scope.topicId ?? null}::text IS NULL OR t.id=${scope.topicId ?? null})
        AND (${scope.userId ?? null}::text IS NULL OR t.user_id=${scope.userId ?? null})
        AND EXISTS (
          SELECT 1 FROM (SELECT 1) seed
          LEFT JOIN cotti_topic_budget_settings s ON s.id='default'
          LEFT JOIN cotti_user_policies u ON u.user_id=t.user_id
          LEFT JOIN cotti_topic_policies p ON p.topic_id=t.id
          WHERE coalesce(s.enabled,true)
            AND coalesce(p.limit_fen,u.topic_limit_fen,s.limit_fen,1000)>f.limit_fen
            AND (
              SELECT coalesce(sum(CASE
                WHEN coalesce(m.usage->>'cost',m.metadata->'usage'->>'cost',m.metadata->>'cost') ~ '^[0-9]+([.][0-9]+)?$'
                THEN coalesce(m.usage->>'cost',m.metadata->'usage'->>'cost',m.metadata->>'cost')::numeric
              END),0)*7.12*100
              FROM messages m WHERE m.topic_id=t.id AND m.user_id=t.user_id AND m.role='assistant'
                AND coalesce(m.metadata->>'copied','')<>'true'
            ) < coalesce(p.limit_fen,u.topic_limit_fen,s.limit_fen,1000)
        )
      RETURNING f.topic_id,t.user_id,to_jsonb(f) AS previous
    )
    INSERT INTO cotti_audit_view_logs(target_type,target_id,target_user_id,metadata)
    SELECT 'topic',topic_id,user_id,jsonb_build_object(
      'source','cotti-topic-budget-reconciliation','action','unfreeze-after-limit-increase','beforeFreeze',previous
    ) FROM released
    RETURNING target_id
  `);
}
