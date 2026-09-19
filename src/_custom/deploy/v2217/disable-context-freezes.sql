-- Run with both application entrances stopped, after the database backup.
-- Idempotent: only obsolete context freezes are released; budget/manual gates remain.
WITH released AS (
  DELETE FROM topic_cost_freezes WHERE reason = 'context' RETURNING *
), audited AS (
  INSERT INTO cotti_audit_view_logs(target_type,target_id,target_user_id,metadata)
  SELECT 'topic',r.topic_id,t.user_id,jsonb_build_object(
    'source','cotti-budget-only-20260915',
    'action','unfreeze-after-context-guard-removal',
    'beforeFreeze',to_jsonb(r)
  ) FROM released r JOIN topics t ON t.id=r.topic_id
  RETURNING target_id
)
SELECT count(*) AS released_context_freezes FROM audited;
