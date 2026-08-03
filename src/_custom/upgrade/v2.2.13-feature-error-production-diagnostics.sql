\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'
\timing on

\echo '===== S5.2-5A FEATURE AND ERROR PRODUCTION DIAGNOSTICS ====='
\echo 'Read-only: no schema or data changes are made.'
\echo 'Privacy: no message content, prompts, tool arguments, file names, or error messages are selected.'

BEGIN READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';
SET LOCAL idle_in_transaction_session_timeout = '90s';

\echo '===== 1. RELEVANT TABLE SIZE AND ROW ESTIMATES ====='
WITH relation_names(name) AS (
  VALUES
    ('messages'),
    ('message_plugins'),
    ('messages_files'),
    ('message_tts'),
    ('generation_topics'),
    ('generation_batches'),
    ('generations'),
    ('async_tasks'),
    ('agent_operations')
)
SELECT
  relation.name,
  statistic.n_live_tup AS estimated_live_rows,
  pg_size_pretty(pg_relation_size(to_regclass(relation.name))) AS table_size,
  pg_size_pretty(pg_indexes_size(to_regclass(relation.name))) AS indexes_size,
  pg_size_pretty(pg_total_relation_size(to_regclass(relation.name))) AS total_size
FROM relation_names AS relation
LEFT JOIN pg_stat_user_tables AS statistic
  ON statistic.schemaname = current_schema()
  AND statistic.relname = relation.name
ORDER BY relation.name;

\echo '===== 2. MESSAGE SEARCH AND TOOL PAYLOAD COVERAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  count(message.id) FILTER (WHERE message.role = 'assistant') AS assistant_messages,
  count(message.id) FILTER (
    WHERE message.role = 'assistant' AND message.search IS NOT NULL
  ) AS search_non_null,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.search IS NOT NULL
      AND message.search IN ('{}'::jsonb, 'null'::jsonb)
  ) AS search_empty_object_or_json_null,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.search IS NOT NULL
      AND (
        jsonb_path_exists(message.search, '$.searchQueries[*]')
        OR jsonb_path_exists(message.search, '$.citations[*]')
        OR jsonb_path_exists(message.search, '$.imageSearchQueries[*]')
        OR jsonb_path_exists(message.search, '$.imageResults[*]')
      )
  ) AS meaningful_search_messages,
  count(DISTINCT message.user_id) FILTER (
    WHERE message.role = 'assistant'
      AND message.search IS NOT NULL
      AND (
        jsonb_path_exists(message.search, '$.searchQueries[*]')
        OR jsonb_path_exists(message.search, '$.citations[*]')
        OR jsonb_path_exists(message.search, '$.imageSearchQueries[*]')
        OR jsonb_path_exists(message.search, '$.imageResults[*]')
      )
  ) AS meaningful_search_users,
  count(message.id) FILTER (
    WHERE message.role = 'assistant' AND message.tools IS NOT NULL
  ) AS tools_non_null,
  count(message.id) FILTER (
    WHERE message.role = 'assistant' AND message.tools = '[]'::jsonb
  ) AS tools_empty_array,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND jsonb_typeof(message.tools) = 'array'
      AND jsonb_array_length(message.tools) > 0
  ) AS messages_with_tool_payloads,
  coalesce(sum(
    CASE
      WHEN message.role = 'assistant' AND jsonb_typeof(message.tools) = 'array'
        THEN jsonb_array_length(message.tools)
      ELSE 0
    END
  ), 0) AS tool_payloads,
  count(DISTINCT message.user_id) FILTER (
    WHERE message.role = 'assistant'
      AND jsonb_typeof(message.tools) = 'array'
      AND jsonb_array_length(message.tools) > 0
  ) AS tool_payload_users
FROM ranges AS range
LEFT JOIN messages AS message
  ON message.created_at >= range.start_at
  AND message.created_at < range.end_at
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 3. SEARCH JSON SHAPE (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  jsonb_typeof(message.search) AS json_type,
  count(*) AS row_count,
  count(*) FILTER (WHERE jsonb_path_exists(message.search, '$.searchQueries[*]'))
    AS with_search_queries,
  count(*) FILTER (WHERE jsonb_path_exists(message.search, '$.citations[*]'))
    AS with_citations,
  count(*) FILTER (WHERE jsonb_path_exists(message.search, '$.imageSearchQueries[*]'))
    AS with_image_search_queries,
  count(*) FILTER (WHERE jsonb_path_exists(message.search, '$.imageResults[*]'))
    AS with_image_results
FROM messages AS message
CROSS JOIN boundaries
WHERE message.created_at >= boundaries.start_at
  AND message.created_at < boundaries.end_at
  AND message.role = 'assistant'
  AND message.search IS NOT NULL
GROUP BY jsonb_typeof(message.search)
ORDER BY row_count DESC, json_type;

\echo '===== 4. PERSISTED TOOL RESULT COVERAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  count(plugin.id) AS tool_results,
  count(DISTINCT plugin.user_id) AS active_users,
  count(plugin.id) FILTER (WHERE plugin.error IS NOT NULL) AS error_results,
  count(plugin.id) FILTER (
    WHERE plugin.identifier IS NULL OR btrim(plugin.identifier) = ''
  ) AS identifier_missing,
  count(plugin.id) FILTER (
    WHERE plugin.api_name IS NULL OR btrim(plugin.api_name) = ''
  ) AS api_name_missing,
  count(plugin.id) FILTER (
    WHERE plugin.intervention->>'status' IN ('rejected', 'aborted')
  ) AS rejected_or_aborted
FROM ranges AS range
LEFT JOIN messages AS message
  ON message.created_at >= range.start_at
  AND message.created_at < range.end_at
LEFT JOIN message_plugins AS plugin ON plugin.id = message.id
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 5. TOOL IDENTITY DISTRIBUTION (90 DAYS, AGGREGATED) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  coalesce(nullif(plugin.identifier, ''), '(missing)') AS identifier,
  coalesce(nullif(plugin.api_name, ''), '(missing)') AS api_name,
  count(*) AS tool_results,
  count(DISTINCT plugin.user_id) AS active_users,
  count(*) FILTER (WHERE plugin.error IS NOT NULL) AS error_results
FROM message_plugins AS plugin
INNER JOIN messages AS message ON message.id = plugin.id
CROSS JOIN boundaries
WHERE message.created_at >= boundaries.start_at
  AND message.created_at < boundaries.end_at
GROUP BY plugin.identifier, plugin.api_name
ORDER BY tool_results DESC, identifier, api_name
LIMIT 30;

\echo '===== 6. ASSISTANT TOOL PAYLOAD TO RESULT MATCHING (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
),
payloads AS (
  SELECT
    payload->>'apiName' AS api_name,
    payload->>'id' AS tool_call_id,
    payload->>'identifier' AS identifier
  FROM messages AS message
  CROSS JOIN boundaries
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(message.tools) = 'array' THEN message.tools
      ELSE '[]'::jsonb
    END
  ) AS payload
  WHERE message.created_at >= boundaries.start_at
    AND message.created_at < boundaries.end_at
    AND message.role = 'assistant'
    AND jsonb_typeof(message.tools) = 'array'
    AND jsonb_array_length(message.tools) > 0
)
SELECT
  count(*) AS tool_payloads,
  count(*) FILTER (WHERE payload.tool_call_id IS NULL OR payload.tool_call_id = '')
    AS tool_call_id_missing,
  count(DISTINCT payload.tool_call_id) FILTER (
    WHERE payload.tool_call_id IS NOT NULL AND payload.tool_call_id <> ''
  ) AS distinct_tool_call_ids,
  count(plugin.id) AS matched_results,
  count(plugin.id) FILTER (WHERE plugin.error IS NOT NULL) AS matched_error_results,
  count(plugin.id) FILTER (
    WHERE payload.identifier IS DISTINCT FROM plugin.identifier
  ) AS identifier_mismatches,
  count(plugin.id) FILTER (
    WHERE payload.api_name IS DISTINCT FROM plugin.api_name
  ) AS api_name_mismatches
FROM payloads AS payload
LEFT JOIN message_plugins AS plugin ON plugin.tool_call_id = payload.tool_call_id;

\echo '===== 7. MESSAGE FILE RELATION USAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  count(file_relation.message_id) AS file_relations,
  count(DISTINCT file_relation.message_id) AS messages_with_files,
  count(DISTINCT file_relation.file_id) AS distinct_files,
  count(DISTINCT file_relation.user_id) AS active_users
FROM ranges AS range
LEFT JOIN messages AS message
  ON message.created_at >= range.start_at
  AND message.created_at < range.end_at
LEFT JOIN messages_files AS file_relation ON file_relation.message_id = message.id
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 8. MESSAGE FILE MIME FAMILY (90 DAYS, AGGREGATED) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  coalesce(nullif(split_part(file.file_type, '/', 1), ''), '(missing)') AS mime_family,
  count(*) AS file_relations,
  count(DISTINCT file.id) AS distinct_files,
  count(DISTINCT file_relation.user_id) AS active_users
FROM messages_files AS file_relation
INNER JOIN messages AS message ON message.id = file_relation.message_id
INNER JOIN files AS file ON file.id = file_relation.file_id
CROSS JOIN boundaries
WHERE message.created_at >= boundaries.start_at
  AND message.created_at < boundaries.end_at
GROUP BY mime_family
ORDER BY file_relations DESC, mime_family;

\echo '===== 9. IMAGE AND VIDEO REQUEST/RESULT COVERAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  topic.type,
  count(DISTINCT batch.id) AS requests,
  count(DISTINCT batch.user_id) AS active_users,
  count(DISTINCT batch.id) FILTER (WHERE generation.id IS NOT NULL) AS requests_with_results,
  count(generation.id) AS result_rows,
  count(generation.id) FILTER (WHERE generation.file_id IS NOT NULL) AS results_with_files,
  count(generation.id) FILTER (WHERE generation.async_task_id IS NULL)
    AS results_without_async_task,
  count(DISTINCT generation.async_task_id) AS distinct_async_tasks,
  count(generation.id) FILTER (WHERE task.error IS NOT NULL) AS results_with_task_error
FROM ranges AS range
LEFT JOIN generation_batches AS batch
  ON batch.created_at >= range.start_at
  AND batch.created_at < range.end_at
LEFT JOIN generation_topics AS topic ON topic.id = batch.generation_topic_id
LEFT JOIN generations AS generation ON generation.generation_batch_id = batch.id
LEFT JOIN async_tasks AS task ON task.id = generation.async_task_id
GROUP BY range.range, range.sort_order, topic.type
HAVING count(batch.id) > 0
ORDER BY range.sort_order, topic.type;

\echo '===== 10. IMAGE AND VIDEO ASYNC STATUS DISTRIBUTION (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  topic.type AS topic_type,
  task.type AS task_type,
  task.status,
  count(*) AS result_rows,
  count(*) FILTER (WHERE generation.file_id IS NOT NULL) AS results_with_files,
  count(*) FILTER (WHERE task.error IS NOT NULL) AS results_with_task_error
FROM generation_batches AS batch
INNER JOIN generation_topics AS topic ON topic.id = batch.generation_topic_id
INNER JOIN generations AS generation ON generation.generation_batch_id = batch.id
LEFT JOIN async_tasks AS task ON task.id = generation.async_task_id
CROSS JOIN boundaries
WHERE batch.created_at >= boundaries.start_at
  AND batch.created_at < boundaries.end_at
GROUP BY topic.type, task.type, task.status
ORDER BY topic.type, result_rows DESC, task.type, task.status;

\echo '===== 11. TTS USAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  count(tts.id) AS tts_records,
  count(DISTINCT tts.user_id) AS active_users,
  count(tts.id) FILTER (WHERE tts.file_id IS NOT NULL) AS records_with_files
FROM ranges AS range
LEFT JOIN messages AS message
  ON message.created_at >= range.start_at
  AND message.created_at < range.end_at
LEFT JOIN message_tts AS tts ON tts.id = message.id
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 12. CHAT ERROR COVERAGE BY RANGE ====='
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
ranges(range, sort_order, start_at, end_at) AS (
  SELECT '7d', 1, start_7d, end_at FROM boundaries
  UNION ALL
  SELECT '30d', 2, start_30d, end_at FROM boundaries
  UNION ALL
  SELECT '90d', 3, start_90d, end_at FROM boundaries
)
SELECT
  range.range,
  count(message.id) FILTER (WHERE message.role = 'assistant') AS assistant_messages,
  count(message.id) FILTER (
    WHERE message.role = 'assistant' AND message.error IS NOT NULL
  ) AS error_messages,
  count(DISTINCT message.user_id) FILTER (
    WHERE message.role = 'assistant' AND message.error IS NOT NULL
  ) AS affected_users,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.error IS NOT NULL
      AND jsonb_typeof(message.error) = 'object'
  ) AS object_errors,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.error IS NOT NULL
      AND coalesce(
        nullif(message.error->>'type', ''),
        nullif(message.error->>'name', ''),
        nullif(message.error->>'errorType', ''),
        nullif(message.error->>'code', '')
      ) IS NOT NULL
  ) AS errors_with_category,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.error IS NOT NULL
      AND (message.provider IS NULL OR btrim(message.provider) = '')
  ) AS provider_missing,
  count(message.id) FILTER (
    WHERE message.role = 'assistant'
      AND message.error IS NOT NULL
      AND (message.model IS NULL OR btrim(message.model) = '')
  ) AS model_missing
FROM ranges AS range
LEFT JOIN messages AS message
  ON message.created_at >= range.start_at
  AND message.created_at < range.end_at
GROUP BY range.range, range.sort_order
ORDER BY range.sort_order;

\echo '===== 13. CHAT ERROR DISTRIBUTION (90 DAYS, NO ERROR MESSAGES) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  message.provider,
  message.model,
  coalesce(
    nullif(message.error->>'type', ''),
    nullif(message.error->>'name', ''),
    nullif(message.error->>'errorType', ''),
    nullif(message.error->>'code', ''),
    '(unclassified)'
  ) AS error_category,
  count(*) AS error_messages,
  count(DISTINCT message.user_id) AS affected_users
FROM messages AS message
CROSS JOIN boundaries
WHERE message.created_at >= boundaries.start_at
  AND message.created_at < boundaries.end_at
  AND message.role = 'assistant'
  AND message.error IS NOT NULL
GROUP BY message.provider, message.model, error_category
ORDER BY error_messages DESC, message.provider, message.model, error_category
LIMIT 30;

\echo '===== 14. CHAT ERROR JSON KEYS (90 DAYS, KEYS ONLY) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
),
error_keys AS (
  SELECT jsonb_object_keys(
    CASE
      WHEN jsonb_typeof(message.error) = 'object' THEN message.error
      ELSE '{}'::jsonb
    END
  ) AS key
  FROM messages AS message
  CROSS JOIN boundaries
  WHERE message.created_at >= boundaries.start_at
    AND message.created_at < boundaries.end_at
    AND message.role = 'assistant'
    AND jsonb_typeof(message.error) = 'object'
)
SELECT key, count(*) AS error_rows_with_key
FROM error_keys
GROUP BY key
ORDER BY error_rows_with_key DESC, key;

\echo '===== 15. AGENT ROOT ERROR COVERAGE AND KEYS (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
),
agent_errors AS (
  SELECT operation.*
  FROM agent_operations AS operation
  CROSS JOIN boundaries
  WHERE operation.created_at >= boundaries.start_at
    AND operation.created_at < boundaries.end_at
    AND operation.parent_operation_id IS NULL
    AND operation.status = 'error'
)
SELECT
  count(*) AS error_executions,
  count(DISTINCT user_id) AS affected_users,
  count(*) FILTER (WHERE error IS NOT NULL) AS with_error_payload,
  count(*) FILTER (WHERE jsonb_typeof(error) = 'object') AS object_errors,
  count(*) FILTER (
    WHERE coalesce(
      nullif(error->>'type', ''),
      nullif(error->>'name', ''),
      nullif(error->>'code', '')
    ) IS NOT NULL
  ) AS errors_with_category,
  count(*) FILTER (WHERE agent_id IS NULL) AS agent_id_missing
FROM agent_errors;

WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
),
error_keys AS (
  SELECT jsonb_object_keys(
    CASE
      WHEN jsonb_typeof(operation.error) = 'object' THEN operation.error
      ELSE '{}'::jsonb
    END
  ) AS key
  FROM agent_operations AS operation
  CROSS JOIN boundaries
  WHERE operation.created_at >= boundaries.start_at
    AND operation.created_at < boundaries.end_at
    AND operation.parent_operation_id IS NULL
    AND operation.status = 'error'
    AND jsonb_typeof(operation.error) = 'object'
)
SELECT key, count(*) AS error_rows_with_key
FROM error_keys
GROUP BY key
ORDER BY error_rows_with_key DESC, key;

\echo '===== 16. BUILT-IN SEARCH AND WEB SEARCH TOOL OVERLAP (90 DAYS) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  count(*) AS web_search_tool_results,
  count(*) FILTER (WHERE tool_message.parent_id IS NULL) AS parent_message_id_missing,
  count(parent_message.id) AS resolved_parent_messages,
  count(parent_message.id) FILTER (
    WHERE parent_message.role = 'assistant'
      AND parent_message.search IS NOT NULL
      AND (
        jsonb_path_exists(parent_message.search, '$.searchQueries[*]')
        OR jsonb_path_exists(parent_message.search, '$.citations[*]')
        OR jsonb_path_exists(parent_message.search, '$.imageSearchQueries[*]')
        OR jsonb_path_exists(parent_message.search, '$.imageResults[*]')
      )
  ) AS parent_messages_with_meaningful_builtin_search
FROM message_plugins AS plugin
INNER JOIN messages AS tool_message ON tool_message.id = plugin.id
LEFT JOIN messages AS parent_message ON parent_message.id = tool_message.parent_id
CROSS JOIN boundaries
WHERE tool_message.created_at >= boundaries.start_at
  AND tool_message.created_at < boundaries.end_at
  AND plugin.identifier = 'lobe-web-browsing'
  AND plugin.api_name = 'search';

\echo '===== 17. MESSAGE FILE RELATION ROLE AND SOURCE (90 DAYS, AGGREGATED) ====='
WITH boundaries AS (
  SELECT
    statement_timestamp() AS end_at,
    (
      date_trunc('day', statement_timestamp() AT TIME ZONE 'Asia/Shanghai')
      - interval '89 days'
    ) AT TIME ZONE 'Asia/Shanghai' AS start_at
)
SELECT
  message.role,
  file.source,
  coalesce(nullif(split_part(file.file_type, '/', 1), ''), '(missing)') AS mime_family,
  count(*) AS file_relations,
  count(DISTINCT file.id) AS distinct_files,
  count(DISTINCT file_relation.user_id) AS active_users
FROM messages_files AS file_relation
INNER JOIN messages AS message ON message.id = file_relation.message_id
INNER JOIN files AS file ON file.id = file_relation.file_id
CROSS JOIN boundaries
WHERE message.created_at >= boundaries.start_at
  AND message.created_at < boundaries.end_at
GROUP BY message.role, file.source, mime_family
ORDER BY file_relations DESC, message.role, file.source, mime_family;

ROLLBACK;

\echo '===== S5.2-5A DIAGNOSTICS COMPLETED ====='
