\set ON_ERROR_STOP on
\pset pager off
\timing on

\echo '===== S5.2-4E AGENT ANALYTICS PRODUCTION DIAGNOSTICS ====='
\echo 'Read-only: no schema or data changes are made.'

BEGIN READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';

\echo '===== 1. DATABASE AND TABLE SIZE ====='
SELECT
  current_database() AS database,
  pg_size_pretty(pg_database_size(current_database())) AS database_size,
  pg_size_pretty(pg_relation_size('agent_operations')) AS operation_table_size,
  pg_size_pretty(pg_indexes_size('agent_operations')) AS operation_indexes_size,
  pg_size_pretty(pg_total_relation_size('agent_operations')) AS operation_total_size;

SELECT
  n_live_tup AS estimated_live_rows,
  n_dead_tup AS estimated_dead_rows,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = current_schema()
  AND relname = 'agent_operations';

\echo '===== 2. CURRENT AGENT OPERATION INDEXES ====='
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'agent_operations'
ORDER BY indexname;

\echo '===== 3. ROOT AND CHILD COVERAGE BY RANGE ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '6 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_7d,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '29 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_30d,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_90d
),
operation_counts AS (
  SELECT
    CASE
      WHEN operation.created_at >= boundaries.start_7d THEN '7d'
      WHEN operation.created_at >= boundaries.start_30d THEN '30d'
      ELSE '90d'
    END AS bucket,
    operation.id,
    operation.parent_operation_id
  FROM agent_operations AS operation
  CROSS JOIN boundaries
  WHERE operation.created_at >= boundaries.start_90d
    AND operation.created_at < boundaries.end_at
)
SELECT
  range.range,
  count(operation.id) FILTER (WHERE operation.parent_operation_id IS NULL) AS root_operations,
  count(operation.id) FILTER (WHERE operation.parent_operation_id IS NOT NULL)
    AS child_operations,
  count(operation.id) AS all_operations
FROM (VALUES ('7d', 1), ('30d', 2), ('90d', 3)) AS range(range, sort_order)
LEFT JOIN operation_counts AS operation
  ON CASE range.range
    WHEN '7d' THEN operation.bucket = '7d'
    WHEN '30d' THEN operation.bucket IN ('7d', '30d')
    ELSE true
  END
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 4. ROOT FIELD AND METRIC COVERAGE (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  count(*) AS root_operations,
  count(*) FILTER (WHERE operation.agent_id IS NULL) AS agent_id_missing,
  count(*) FILTER (WHERE agent.id IS NULL) AS unresolved_agent,
  count(*) FILTER (WHERE operation.trigger IS NULL OR btrim(operation.trigger) = '')
    AS trigger_missing,
  count(*) FILTER (WHERE operation.status NOT IN ('done', 'error', 'interrupted'))
    AS non_terminal,
  count(*) FILTER (
    WHERE operation.status IN ('done', 'error', 'interrupted')
      AND operation.completed_at IS NULL
  ) AS terminal_completed_at_missing,
  count(*) FILTER (WHERE operation.llm_calls IS NULL) AS llm_calls_missing,
  count(*) FILTER (WHERE operation.tool_calls IS NULL) AS tool_calls_missing,
  count(*) FILTER (WHERE operation.total_tokens IS NULL) AS total_tokens_missing,
  count(*) FILTER (WHERE operation.total_cost IS NULL) AS total_cost_missing,
  count(*) FILTER (WHERE operation.processing_time_ms IS NULL) AS processing_time_missing
FROM agent_operations AS operation
CROSS JOIN boundaries
LEFT JOIN agents AS agent ON agent.id = operation.agent_id
WHERE operation.created_at >= boundaries.start_at
  AND operation.created_at < boundaries.end_at
  AND operation.parent_operation_id IS NULL;

\echo '===== 5. CHILD PARENT COVERAGE (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  count(*) AS child_operations,
  count(*) FILTER (WHERE parent.id IS NULL) AS unresolved_parent,
  count(*) FILTER (WHERE parent.parent_operation_id IS NOT NULL) AS nested_under_child
FROM agent_operations AS child
CROSS JOIN boundaries
LEFT JOIN agent_operations AS parent ON parent.id = child.parent_operation_id
WHERE child.created_at >= boundaries.start_at
  AND child.created_at < boundaries.end_at
  AND child.parent_operation_id IS NOT NULL;

\echo '===== 6. ROOT STATUS DISTRIBUTION (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT operation.status, operation.completion_reason, count(*) AS operation_count
FROM agent_operations AS operation
CROSS JOIN boundaries
WHERE operation.created_at >= boundaries.start_at
  AND operation.created_at < boundaries.end_at
  AND operation.parent_operation_id IS NULL
GROUP BY operation.status, operation.completion_reason
ORDER BY operation_count DESC, operation.status, operation.completion_reason;

\echo '===== 7. ROOT TRIGGER DISTRIBUTION (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT operation.trigger, count(*) AS operation_count
FROM agent_operations AS operation
CROSS JOIN boundaries
WHERE operation.created_at >= boundaries.start_at
  AND operation.created_at < boundaries.end_at
  AND operation.parent_operation_id IS NULL
GROUP BY operation.trigger
ORDER BY operation_count DESC, operation.trigger;

\echo '===== 8. 7-DAY ROOT AGENT AGGREGATION PLAN ====='
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH agent_usage AS (
  SELECT
    operation.agent_id,
    count(*) AS executions,
    count(DISTINCT operation.user_id) AS active_users,
    count(*) FILTER (WHERE operation.status = 'error') AS error_executions,
    count(*) FILTER (WHERE operation.status = 'interrupted') AS interrupted_executions,
    count(operation.total_tokens) AS token_recorded_executions,
    count(operation.total_cost) AS cost_recorded_executions,
    coalesce(sum(operation.llm_calls), 0) AS llm_calls,
    coalesce(sum(operation.tool_calls), 0) AS tool_calls,
    coalesce(sum(operation.total_input_tokens), 0) AS total_input_tokens,
    coalesce(sum(operation.total_output_tokens), 0) AS total_output_tokens,
    coalesce(sum(operation.total_tokens), 0) AS total_tokens,
    coalesce(sum(operation.total_cost), 0) AS recorded_cost,
    coalesce(avg(operation.processing_time_ms), 0) AS average_processing_time_ms,
    max(operation.created_at) AS last_executed_at
  FROM agent_operations AS operation
  WHERE operation.created_at >= (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '6 days'
    ) AT TIME ZONE 'Asia/Shanghai'
    AND operation.created_at < statement_timestamp()
    AND operation.parent_operation_id IS NULL
    AND operation.status IN ('done', 'error', 'interrupted')
  GROUP BY operation.agent_id
)
SELECT
  usage.*,
  agent.title,
  agent.avatar,
  count(*) OVER () AS total_agent_groups
FROM agent_usage AS usage
LEFT JOIN agents AS agent ON agent.id = usage.agent_id
ORDER BY usage.total_tokens DESC, usage.executions DESC, usage.agent_id ASC NULLS LAST
LIMIT 20;

\echo '===== 9. 30-DAY ROOT AGENT AGGREGATION PLAN ====='
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH agent_usage AS (
  SELECT
    operation.agent_id,
    count(*) AS executions,
    count(DISTINCT operation.user_id) AS active_users,
    count(*) FILTER (WHERE operation.status = 'error') AS error_executions,
    count(*) FILTER (WHERE operation.status = 'interrupted') AS interrupted_executions,
    count(operation.total_tokens) AS token_recorded_executions,
    count(operation.total_cost) AS cost_recorded_executions,
    coalesce(sum(operation.llm_calls), 0) AS llm_calls,
    coalesce(sum(operation.tool_calls), 0) AS tool_calls,
    coalesce(sum(operation.total_input_tokens), 0) AS total_input_tokens,
    coalesce(sum(operation.total_output_tokens), 0) AS total_output_tokens,
    coalesce(sum(operation.total_tokens), 0) AS total_tokens,
    coalesce(sum(operation.total_cost), 0) AS recorded_cost,
    coalesce(avg(operation.processing_time_ms), 0) AS average_processing_time_ms,
    max(operation.created_at) AS last_executed_at
  FROM agent_operations AS operation
  WHERE operation.created_at >= (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '29 days'
    ) AT TIME ZONE 'Asia/Shanghai'
    AND operation.created_at < statement_timestamp()
    AND operation.parent_operation_id IS NULL
    AND operation.status IN ('done', 'error', 'interrupted')
  GROUP BY operation.agent_id
)
SELECT
  usage.*,
  agent.title,
  agent.avatar,
  count(*) OVER () AS total_agent_groups
FROM agent_usage AS usage
LEFT JOIN agents AS agent ON agent.id = usage.agent_id
ORDER BY usage.total_tokens DESC, usage.executions DESC, usage.agent_id ASC NULLS LAST
LIMIT 20;

\echo '===== 10. 90-DAY ROOT AGENT AGGREGATION PLAN ====='
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH agent_usage AS (
  SELECT
    operation.agent_id,
    count(*) AS executions,
    count(DISTINCT operation.user_id) AS active_users,
    count(*) FILTER (WHERE operation.status = 'error') AS error_executions,
    count(*) FILTER (WHERE operation.status = 'interrupted') AS interrupted_executions,
    count(operation.total_tokens) AS token_recorded_executions,
    count(operation.total_cost) AS cost_recorded_executions,
    coalesce(sum(operation.llm_calls), 0) AS llm_calls,
    coalesce(sum(operation.tool_calls), 0) AS tool_calls,
    coalesce(sum(operation.total_input_tokens), 0) AS total_input_tokens,
    coalesce(sum(operation.total_output_tokens), 0) AS total_output_tokens,
    coalesce(sum(operation.total_tokens), 0) AS total_tokens,
    coalesce(sum(operation.total_cost), 0) AS recorded_cost,
    coalesce(avg(operation.processing_time_ms), 0) AS average_processing_time_ms,
    max(operation.created_at) AS last_executed_at
  FROM agent_operations AS operation
  WHERE operation.created_at >= (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai'
    AND operation.created_at < statement_timestamp()
    AND operation.parent_operation_id IS NULL
    AND operation.status IN ('done', 'error', 'interrupted')
  GROUP BY operation.agent_id
)
SELECT
  usage.*,
  agent.title,
  agent.avatar,
  count(*) OVER () AS total_agent_groups
FROM agent_usage AS usage
LEFT JOIN agents AS agent ON agent.id = usage.agent_id
ORDER BY usage.total_tokens DESC, usage.executions DESC, usage.agent_id ASC NULLS LAST
LIMIT 20;

ROLLBACK;

\echo '===== S5.2-4E DIAGNOSTICS COMPLETED ====='
