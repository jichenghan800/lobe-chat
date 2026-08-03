\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'
\timing on

\echo '===== S5 PLATFORM ANALYTICS PRODUCTION ACCEPTANCE ====='
\echo 'Read-only: no schema or data changes are made.'
\echo 'Privacy: plans and aggregate snapshots do not select message content, prompts, tool arguments, file names, raw errors, traces, or user identities.'

BEGIN READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';
SET LOCAL idle_in_transaction_session_timeout = '15min';

\echo '===== 1. READ-ONLY AND DATABASE GATE ====='
SELECT
  current_database() AS database,
  current_setting('transaction_read_only') AS transaction_read_only,
  current_setting('lock_timeout') AS lock_timeout,
  current_setting('statement_timeout') AS statement_timeout,
  pg_size_pretty(pg_database_size(current_database())) AS database_size;

\echo '===== 2. REQUIRED TABLES AND SIZE ESTIMATES ====='
WITH required_tables(name) AS (
  VALUES
    ('users'),
    ('messages'),
    ('message_plugins'),
    ('messages_files'),
    ('generation_topics'),
    ('generation_batches'),
    ('generations'),
    ('async_tasks'),
    ('agents'),
    ('agent_operations')
)
SELECT
  required.name,
  to_regclass(required.name) IS NOT NULL AS present,
  statistic.n_live_tup AS estimated_live_rows,
  pg_size_pretty(pg_relation_size(to_regclass(required.name))) AS table_size,
  pg_size_pretty(pg_indexes_size(to_regclass(required.name))) AS indexes_size
FROM required_tables AS required
LEFT JOIN pg_stat_user_tables AS statistic
  ON statistic.schemaname = current_schema()
  AND statistic.relname = required.name
ORDER BY required.name;

DO $gate$
DECLARE
  missing_tables text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name)
  INTO missing_tables
  FROM (
    VALUES
      ('users'),
      ('messages'),
      ('message_plugins'),
      ('messages_files'),
      ('generation_topics'),
      ('generation_batches'),
      ('generations'),
      ('async_tasks'),
      ('agents'),
      ('agent_operations')
  ) AS required(name)
  WHERE to_regclass(required.name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required analytics tables: %', missing_tables;
  END IF;
END
$gate$;

\echo '===== 3. RELEVANT INDEX INVENTORY ====='
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename IN (
    'users',
    'messages',
    'message_plugins',
    'messages_files',
    'generation_batches',
    'generation_topics',
    'generations',
    'async_tasks',
    'agents',
    'agent_operations'
  )
ORDER BY tablename, indexname;

\echo '===== 4. FINAL QUERY PLANS: 1 / 7 / 30 / 90 DAYS ====='
\echo 'Each generated statement has its own 45-second timeout. Plans execute sequentially to avoid manufacturing production concurrency.'

WITH
boundaries AS (
  SELECT transaction_timestamp() AS end_at
),
ranges(days, sort_order, start_at, end_at) AS (
  SELECT
    days,
    sort_order,
    (
      date_trunc('day', boundaries.end_at AT TIME ZONE 'Asia/Shanghai')
      - make_interval(days => days - 1)
    ) AT TIME ZONE 'Asia/Shanghai',
    boundaries.end_at
  FROM boundaries
  CROSS JOIN (VALUES (1, 1), (7, 2), (30, 3), (90, 4)) AS requested(days, sort_order)
),
queries(query_order, query_name, query_template) AS (
  VALUES
    (1, 'overview_users', $query$
      SELECT
        count(*) FILTER (WHERE users.created_at >= <START_AT>::timestamptz AND users.created_at < <END_AT>::timestamptz) AS new_users,
        count(*) FILTER (WHERE users.created_at < <END_AT>::timestamptz) AS total_users
      FROM users
    $query$),
    (2, 'overview_messages', $query$
      SELECT
        count(DISTINCT messages.topic_id) FILTER (WHERE messages.topic_id IS NOT NULL) AS active_topics,
        count(DISTINCT messages.user_id) FILTER (WHERE messages.role = 'user') AS active_users,
        count(*) FILTER (WHERE messages.role = 'assistant') AS assistant_messages,
        count(*) FILTER (WHERE messages.role = 'assistant' AND messages.error IS NOT NULL) AS error_messages,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS recorded_cost,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_input_tokens,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_output_tokens,
        count(*) FILTER (WHERE messages.role = 'user') AS user_messages
      FROM messages
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role IN ('assistant', 'user')
    $query$),
    (3, 'trends', $query$
      SELECT
        to_char(messages.created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day,
        count(DISTINCT messages.user_id) FILTER (WHERE messages.role = 'user') AS active_users,
        count(*) FILTER (WHERE messages.role = 'assistant') AS assistant_messages,
        count(*) FILTER (WHERE messages.role = 'assistant' AND messages.error IS NOT NULL) AS error_messages,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS recorded_cost,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
          + CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_tokens,
        count(*) FILTER (WHERE messages.role = 'user') AS user_messages
      FROM messages
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role IN ('assistant', 'user')
      GROUP BY to_char(messages.created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
      ORDER BY day
    $query$),
    (4, 'chat_users', $query$
      SELECT
        users.id,
        count(DISTINCT (messages.created_at AT TIME ZONE 'Asia/Shanghai')::date) FILTER (WHERE messages.role = 'user') AS active_days,
        count(DISTINCT messages.topic_id) FILTER (WHERE messages.topic_id IS NOT NULL) AS active_topics,
        count(*) FILTER (WHERE messages.role = 'assistant') AS assistant_messages,
        count(*) FILTER (WHERE messages.role = 'assistant' AND messages.error IS NOT NULL) AS error_messages,
        max(messages.created_at) FILTER (WHERE messages.role = 'user') AS last_active_at,
        count(*) OVER () AS total,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS recorded_cost,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_input_tokens,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_output_tokens,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
          + CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ) FILTER (WHERE messages.role = 'assistant'), 0) AS total_tokens,
        count(*) FILTER (WHERE messages.role = 'user') AS user_messages
      FROM messages
      INNER JOIN users ON users.id = messages.user_id
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role IN ('assistant', 'user')
      GROUP BY users.id
      ORDER BY total_tokens DESC, users.id ASC
      LIMIT 20
    $query$),
    (5, 'chat_models', $query$
      SELECT
        messages.provider,
        messages.model,
        count(DISTINCT messages.user_id) AS active_users,
        count(*) AS assistant_messages,
        count(*) FILTER (WHERE messages.error IS NOT NULL) AS error_messages,
        count(*) OVER () AS total,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost')::numeric
            ELSE 0
          END
        ), 0) AS recorded_cost,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
        ), 0) AS total_input_tokens,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ), 0) AS total_output_tokens,
        coalesce(sum(
          CASE
            WHEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalInputTokens', messages.metadata->'usage'->>'totalInputTokens', messages.metadata->>'totalInputTokens')::numeric
            ELSE 0
          END
          + CASE
            WHEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens') ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN coalesce(messages.usage->>'totalOutputTokens', messages.metadata->'usage'->>'totalOutputTokens', messages.metadata->>'totalOutputTokens')::numeric
            ELSE 0
          END
        ), 0) AS total_tokens
      FROM messages
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role = 'assistant'
      GROUP BY messages.provider, messages.model
      ORDER BY total_tokens DESC, messages.provider ASC NULLS LAST, messages.model ASC NULLS LAST
      LIMIT 20
    $query$),
    (6, 'agents', $query$
      WITH usage AS (
        SELECT
          agent_operations.agent_id,
          count(DISTINCT agent_operations.user_id) AS active_users,
          coalesce(avg(agent_operations.processing_time_ms), 0) AS average_processing_time_ms,
          count(agent_operations.total_cost) AS cost_recorded_executions,
          count(*) FILTER (WHERE agent_operations.status = 'error') AS error_executions,
          count(*) AS executions,
          count(*) FILTER (WHERE agent_operations.status = 'interrupted') AS interrupted_executions,
          max(agent_operations.created_at) AS last_executed_at,
          coalesce(sum(agent_operations.llm_calls), 0) AS llm_calls,
          coalesce(sum(agent_operations.total_cost), 0) AS recorded_cost,
          count(agent_operations.total_tokens) AS token_recorded_executions,
          coalesce(sum(agent_operations.tool_calls), 0) AS tool_calls,
          coalesce(sum(agent_operations.total_input_tokens), 0) AS total_input_tokens,
          coalesce(sum(agent_operations.total_output_tokens), 0) AS total_output_tokens,
          coalesce(sum(agent_operations.total_tokens), 0) AS total_tokens
        FROM agent_operations
        WHERE agent_operations.created_at >= <START_AT>::timestamptz
          AND agent_operations.created_at < <END_AT>::timestamptz
          AND agent_operations.parent_operation_id IS NULL
          AND agent_operations.status IN ('done', 'error', 'interrupted')
        GROUP BY agent_operations.agent_id
      )
      SELECT usage.*, agents.title, agents.avatar, count(*) OVER () AS total
      FROM usage
      LEFT JOIN agents ON agents.id = usage.agent_id
      ORDER BY usage.total_tokens DESC, usage.agent_id ASC NULLS LAST
      LIMIT 20
    $query$),
    (7, 'feature_search', $query$
      WITH search_events AS (
        SELECT 'builtin' AS event_type, messages.user_id
        FROM messages
        WHERE messages.created_at >= <START_AT>::timestamptz
          AND messages.created_at < <END_AT>::timestamptz
          AND messages.role = 'assistant'
          AND messages.search IS NOT NULL
          AND (
            jsonb_path_exists(messages.search, '$.searchQueries[*]')
            OR jsonb_path_exists(messages.search, '$.citations[*]')
            OR jsonb_path_exists(messages.search, '$.imageSearchQueries[*]')
            OR jsonb_path_exists(messages.search, '$.imageResults[*]')
          )
        UNION ALL
        SELECT 'webTool' AS event_type, message_plugins.user_id
        FROM message_plugins
        INNER JOIN messages ON messages.id = message_plugins.id
        WHERE messages.created_at >= <START_AT>::timestamptz
          AND messages.created_at < <END_AT>::timestamptz
          AND message_plugins.identifier = 'lobe-web-browsing'
          AND message_plugins.api_name = 'search'
      )
      SELECT
        count(DISTINCT search_events.user_id) AS active_users,
        count(*) FILTER (WHERE search_events.event_type = 'builtin') AS builtin_search_messages,
        count(*) AS total_search_events,
        count(*) FILTER (WHERE search_events.event_type = 'webTool') AS web_search_tool_results
      FROM search_events
    $query$),
    (8, 'feature_tools', $query$
      SELECT
        count(DISTINCT message_plugins.user_id) AS active_users,
        count(*) FILTER (WHERE message_plugins.error IS NOT NULL) AS error_results,
        count(*) FILTER (WHERE message_plugins.intervention->>'status' IN ('rejected', 'aborted')) AS rejected_or_aborted_results,
        count(*) AS results
      FROM message_plugins
      INNER JOIN messages ON messages.id = message_plugins.id
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
    $query$),
    (9, 'feature_files', $query$
      SELECT
        count(DISTINCT messages_files.user_id) AS active_users,
        count(DISTINCT messages_files.file_id) AS distinct_files,
        count(*) AS file_relations,
        count(DISTINCT messages_files.message_id) AS messages_with_files
      FROM messages_files
      INNER JOIN messages ON messages.id = messages_files.message_id
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role = 'user'
    $query$),
    (10, 'feature_generation', $query$
      SELECT
        generation_topics.type,
        count(DISTINCT generation_batches.user_id) AS active_users,
        count(generations.id) FILTER (WHERE async_tasks.status = 'error') AS error_results,
        count(DISTINCT generation_batches.id) AS requests,
        count(DISTINCT generation_batches.id) FILTER (WHERE generations.id IS NULL) AS requests_without_results,
        count(generations.id) AS result_rows,
        count(generations.id) FILTER (WHERE async_tasks.status = 'success' AND generations.file_id IS NOT NULL) AS successful_assets
      FROM generation_batches
      INNER JOIN generation_topics ON generation_topics.id = generation_batches.generation_topic_id
      LEFT JOIN generations ON generations.generation_batch_id = generation_batches.id
      LEFT JOIN async_tasks ON async_tasks.id = generations.async_task_id
      WHERE generation_batches.created_at >= <START_AT>::timestamptz
        AND generation_batches.created_at < <END_AT>::timestamptz
        AND generation_topics.type IN ('image', 'video')
      GROUP BY generation_topics.type
    $query$),
    (11, 'chat_errors', $query$
      SELECT
        messages.provider,
        messages.model,
        coalesce(
          nullif(btrim(messages.error->>'category'), ''),
          nullif(btrim(messages.error->>'type'), ''),
          nullif(btrim(messages.error->>'name'), ''),
          nullif(btrim(messages.error->>'errorType'), ''),
          nullif(btrim(messages.error->>'code'), '')
        ) AS category,
        count(DISTINCT messages.user_id) AS affected_users,
        count(*) AS error_messages,
        count(*) OVER () AS total
      FROM messages
      WHERE messages.created_at >= <START_AT>::timestamptz
        AND messages.created_at < <END_AT>::timestamptz
        AND messages.role = 'assistant'
        AND messages.error IS NOT NULL
      GROUP BY messages.provider, messages.model, category
      ORDER BY error_messages DESC, messages.provider ASC NULLS LAST, messages.model ASC NULLS LAST, category ASC NULLS LAST
      LIMIT 20
    $query$),
    (12, 'agent_errors', $query$
      WITH error_groups AS (
        SELECT
          agent_operations.agent_id,
          coalesce(
            nullif(btrim(agent_operations.error->>'category'), ''),
            nullif(btrim(agent_operations.error->>'type'), ''),
            nullif(btrim(agent_operations.error->>'name'), ''),
            nullif(btrim(agent_operations.error->>'errorType'), ''),
            nullif(btrim(agent_operations.error->>'code'), '')
          ) AS category,
          count(DISTINCT agent_operations.user_id) AS affected_users,
          count(*) AS error_executions
        FROM agent_operations
        WHERE agent_operations.created_at >= <START_AT>::timestamptz
          AND agent_operations.created_at < <END_AT>::timestamptz
          AND agent_operations.parent_operation_id IS NULL
          AND agent_operations.status = 'error'
        GROUP BY agent_operations.agent_id, category
      )
      SELECT error_groups.*, agents.title, agents.avatar, count(*) OVER () AS total
      FROM error_groups
      LEFT JOIN agents ON agents.id = error_groups.agent_id
      ORDER BY error_groups.error_executions DESC, error_groups.agent_id ASC NULLS LAST, error_groups.category ASC NULLS LAST
      LIMIT 20
    $query$)
)
SELECT format(
  'SELECT %L AS plan_scope; EXPLAIN (ANALYZE, BUFFERS, SETTINGS, TIMING OFF, SUMMARY ON) %s;',
  queries.query_name || '|' || ranges.days || 'd',
  replace(
    replace(queries.query_template, '<START_AT>', quote_literal(ranges.start_at)),
    '<END_AT>',
    quote_literal(ranges.end_at)
  )
)
FROM queries
CROSS JOIN ranges
ORDER BY queries.query_order, ranges.sort_order
\gexec

\echo '===== 5. 90-DAY AGGREGATE DATA SNAPSHOT ====='
\echo 'These are aggregate-only comparison values for later API/UI acceptance.'

WITH boundary AS (
  SELECT
    transaction_timestamp() AS end_at,
    (
      date_trunc('day', transaction_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  'overview' AS snapshot,
  jsonb_build_object(
    'activeTopics', count(DISTINCT messages.topic_id) FILTER (WHERE messages.topic_id IS NOT NULL),
    'activeUsers', count(DISTINCT messages.user_id) FILTER (WHERE messages.role = 'user'),
    'assistantMessages', count(*) FILTER (WHERE messages.role = 'assistant'),
    'errorMessages', count(*) FILTER (WHERE messages.role = 'assistant' AND messages.error IS NOT NULL),
    'userMessages', count(*) FILTER (WHERE messages.role = 'user')
  ) AS values
FROM messages
CROSS JOIN boundary
WHERE messages.created_at >= boundary.start_at
  AND messages.created_at < boundary.end_at
  AND messages.role IN ('assistant', 'user');

WITH boundary AS (
  SELECT
    transaction_timestamp() AS end_at,
    (
      date_trunc('day', transaction_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  'detailGroups' AS snapshot,
  jsonb_build_object(
    'chatUsers', (
      SELECT count(DISTINCT messages.user_id)
      FROM messages
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND messages.role IN ('assistant', 'user')
    ),
    'chatModels', (
      SELECT count(*)
      FROM (
        SELECT messages.provider, messages.model
        FROM messages
        WHERE messages.created_at >= boundary.start_at
          AND messages.created_at < boundary.end_at
          AND messages.role = 'assistant'
        GROUP BY messages.provider, messages.model
      ) AS model_groups
    ),
    'agents', (
      SELECT count(*)
      FROM (
        SELECT agent_operations.agent_id
        FROM agent_operations
        WHERE agent_operations.created_at >= boundary.start_at
          AND agent_operations.created_at < boundary.end_at
          AND agent_operations.parent_operation_id IS NULL
          AND agent_operations.status IN ('done', 'error', 'interrupted')
        GROUP BY agent_operations.agent_id
      ) AS agent_groups
    )
  ) AS values
FROM boundary;

WITH boundary AS (
  SELECT
    transaction_timestamp() AS end_at,
    (
      date_trunc('day', transaction_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
),
search_events AS (
  SELECT 'builtin' AS event_type, messages.user_id
  FROM messages
  CROSS JOIN boundary
  WHERE messages.created_at >= boundary.start_at
    AND messages.created_at < boundary.end_at
    AND messages.role = 'assistant'
    AND messages.search IS NOT NULL
    AND (
      jsonb_path_exists(messages.search, '$.searchQueries[*]')
      OR jsonb_path_exists(messages.search, '$.citations[*]')
      OR jsonb_path_exists(messages.search, '$.imageSearchQueries[*]')
      OR jsonb_path_exists(messages.search, '$.imageResults[*]')
    )
  UNION ALL
  SELECT 'webTool' AS event_type, message_plugins.user_id
  FROM message_plugins
  INNER JOIN messages ON messages.id = message_plugins.id
  CROSS JOIN boundary
  WHERE messages.created_at >= boundary.start_at
    AND messages.created_at < boundary.end_at
    AND message_plugins.identifier = 'lobe-web-browsing'
    AND message_plugins.api_name = 'search'
)
SELECT
  'searchFeature' AS snapshot,
  jsonb_build_object(
    'activeUsers', count(DISTINCT search_events.user_id),
    'builtinSearchMessages', count(*) FILTER (WHERE search_events.event_type = 'builtin'),
    'totalSearchEvents', count(*),
    'webSearchToolResults', count(*) FILTER (WHERE search_events.event_type = 'webTool')
  ) AS values
FROM search_events;

WITH boundary AS (
  SELECT
    transaction_timestamp() AS end_at,
    (
      date_trunc('day', transaction_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  'toolAndFileFeatures' AS snapshot,
  jsonb_build_object(
    'toolResults', (
      SELECT count(*)
      FROM message_plugins
      INNER JOIN messages ON messages.id = message_plugins.id
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
    ),
    'toolErrorResults', (
      SELECT count(*)
      FROM message_plugins
      INNER JOIN messages ON messages.id = message_plugins.id
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND message_plugins.error IS NOT NULL
    ),
    'fileRelations', (
      SELECT count(*)
      FROM messages_files
      INNER JOIN messages ON messages.id = messages_files.message_id
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND messages.role = 'user'
    ),
    'distinctFiles', (
      SELECT count(DISTINCT messages_files.file_id)
      FROM messages_files
      INNER JOIN messages ON messages.id = messages_files.message_id
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND messages.role = 'user'
    )
  ) AS values
FROM boundary;

WITH boundary AS (
  SELECT
    transaction_timestamp() AS end_at,
    (
      date_trunc('day', transaction_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  'errors' AS snapshot,
  jsonb_build_object(
    'chatErrorMessages', (
      SELECT count(*)
      FROM messages
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND messages.role = 'assistant'
        AND messages.error IS NOT NULL
    ),
    'chatAffectedUsers', (
      SELECT count(DISTINCT messages.user_id)
      FROM messages
      WHERE messages.created_at >= boundary.start_at
        AND messages.created_at < boundary.end_at
        AND messages.role = 'assistant'
        AND messages.error IS NOT NULL
    ),
    'agentErrorExecutions', (
      SELECT count(*)
      FROM agent_operations
      WHERE agent_operations.created_at >= boundary.start_at
        AND agent_operations.created_at < boundary.end_at
        AND agent_operations.parent_operation_id IS NULL
        AND agent_operations.status = 'error'
    ),
    'agentAffectedUsers', (
      SELECT count(DISTINCT agent_operations.user_id)
      FROM agent_operations
      WHERE agent_operations.created_at >= boundary.start_at
        AND agent_operations.created_at < boundary.end_at
        AND agent_operations.parent_operation_id IS NULL
        AND agent_operations.status = 'error'
    )
  ) AS values
FROM boundary;

ROLLBACK;

\echo '===== S5 PLATFORM ANALYTICS ACCEPTANCE COMPLETED ====='
