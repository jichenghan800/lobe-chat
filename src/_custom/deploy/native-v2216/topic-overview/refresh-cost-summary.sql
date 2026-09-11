-- Derived display totals only. Does not modify message costs or invoke budget freezing.
-- Retry in bounded id ranges with psql -v after_id=... -v batch_size=100.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
WITH batch AS MATERIALIZED (
  SELECT id,user_id FROM topics WHERE id > :'after_id' ORDER BY id LIMIT :batch_size FOR UPDATE
), grouped AS (
  SELECT b.id, m.provider,m.model,
    sum(CASE WHEN coalesce(m.usage->>'cost',m.metadata->'usage'->>'cost',m.metadata->>'cost') ~ '^[0-9]+([.][0-9]+)?$' THEN coalesce(m.usage->>'cost',m.metadata->'usage'->>'cost',m.metadata->>'cost')::numeric END) AS cost
  FROM batch b JOIN messages m ON m.topic_id=b.id AND m.user_id=b.user_id
  WHERE m.role='assistant' AND coalesce(m.metadata->>'copied','') <> 'true'
  GROUP BY b.id,m.provider,m.model
), aggregated AS (
  SELECT id,sum(cost) AS cost FROM grouped GROUP BY id
)
UPDATE topics t SET cost=jsonb_set(coalesce(t.cost,'{}'::jsonb),'{llm}',coalesce(t.cost->'llm','{}'::jsonb)||jsonb_build_object('total',a.cost))
FROM aggregated a WHERE t.id=a.id AND a.cost IS NOT NULL AND (t.cost->'llm'->>'total')::numeric IS DISTINCT FROM a.cost;
COMMIT;
