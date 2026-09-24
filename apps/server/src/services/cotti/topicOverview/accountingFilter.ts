import { sql } from 'drizzle-orm';

/** A known pre-provider rejection is not missing billing. Preserve any recorded usage. */
export const billableMessageFilter = sql`NOT (
  coalesce(messages.error->'body'->'error'->>'code', '') = 'TOPIC_COST_FROZEN'
  AND coalesce(messages.usage, '{}'::jsonb) = '{}'::jsonb
  AND coalesce(messages.metadata->'usage', '{}'::jsonb) = '{}'::jsonb
  AND NOT (coalesce(messages.metadata, '{}'::jsonb) ?| ARRAY[
    'cost', 'totalInputTokens', 'totalOutputTokens', 'inputCachedTokens', 'inputWriteCacheTokens'
  ])
)`;
