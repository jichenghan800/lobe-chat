import pg from 'pg';

const { Pool } = pg;

const SOURCE_MODEL = 'gemini-3.6-flash';
const TARGET_MODEL = 'gemini-3.7-flash';
const AGENT_BATCH_SIZE = 500;
const LOCK_NAME = 'lobehub:cotti:gemini-37-upgrade';

const apply = new Set(process.argv.slice(2)).has('--apply');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString, max: 1 });

interface UpgradeState {
  agentCount: number;
  agentDefaultCount: number;
  displayCount: number;
  legacyThinkingLevelCount: number;
}

const getUpgradeState = async (client: pg.PoolClient): Promise<UpgradeState> => {
  const result = await client.query<{
    agent_count: string;
    agent_default_count: string;
    display_count: string;
    legacy_thinking_level_count: string;
  }>(
    `
      SELECT
        (
          SELECT count(*)::text
          FROM agents
          WHERE lower(provider) = 'vertexai' AND lower(model) = $1
        ) AS agent_count,
        (
          SELECT count(*)::text
          FROM cotti_model_display_settings
          WHERE id = 'default'
            AND lower(config #>> '{defaults,agent,provider}') = 'vertexai'
            AND lower(config #>> '{defaults,agent,model}') = $1
        ) AS agent_default_count,
        (
          SELECT count(*)::text
          FROM cotti_model_display_settings settings
          CROSS JOIN LATERAL (
            SELECT item
            FROM jsonb_array_elements(COALESCE(settings.config->'chat', '[]'::jsonb)) AS item
            UNION ALL
            SELECT item
            FROM jsonb_array_elements(COALESCE(settings.config->'agent', '[]'::jsonb)) AS item
          ) entries
          WHERE settings.id = 'default'
            AND lower(entries.item->>'provider') = 'vertexai'
            AND lower(entries.item->>'displayName') = lower('COTTI-专业')
            AND lower(entries.item->>'model') = $1
        ) AS display_count,
        (
          SELECT count(*)::text
          FROM agents
          WHERE lower(provider) = 'vertexai'
            AND lower(model) = $2
            AND chat_config->>'thinkingLevel' IN ('minimal', 'low', 'medium', 'high')
        ) AS legacy_thinking_level_count
    `,
    [SOURCE_MODEL, TARGET_MODEL],
  );
  const state = result.rows[0];

  return {
    agentCount: Number(state.agent_count),
    agentDefaultCount: Number(state.agent_default_count),
    displayCount: Number(state.display_count),
    legacyThinkingLevelCount: Number(state.legacy_thinking_level_count),
  };
};

const replaceLegacyThinkingLevels = async (client: pg.PoolClient) => {
  const result = await client.query(
    `
      UPDATE agents
      SET
        chat_config = CASE
          WHEN chat_config ? 'thinkingLevel3' THEN chat_config - 'thinkingLevel'
          ELSE jsonb_set(
            chat_config - 'thinkingLevel',
            '{thinkingLevel3}',
            to_jsonb(
              CASE chat_config->>'thinkingLevel'
                WHEN 'minimal' THEN 'low'
                ELSE chat_config->>'thinkingLevel'
              END
            ),
            true
          )
        END,
        updated_at = now()
      WHERE lower(provider) = 'vertexai'
        AND lower(model) = $1
        AND chat_config->>'thinkingLevel' IN ('minimal', 'low', 'medium', 'high')
    `,
    [TARGET_MODEL],
  );

  return result.rowCount ?? 0;
};

const replaceDisplayScope = async (client: pg.PoolClient, scope: 'agent' | 'chat') => {
  await client.query(
    `
      UPDATE cotti_model_display_settings
      SET
        config = jsonb_set(
          config,
          ARRAY[$1]::text[],
          COALESCE(
            (
              SELECT jsonb_agg(
                CASE
                  WHEN lower(item->>'provider') = 'vertexai'
                    AND lower(item->>'displayName') = lower('COTTI-专业')
                    AND lower(item->>'model') = $2
                    THEN jsonb_set(item, '{model}', to_jsonb($3::text), false)
                  ELSE item
                END
                ORDER BY ordinality
              )
              FROM jsonb_array_elements(COALESCE(config->$1, '[]'::jsonb))
                WITH ORDINALITY AS entries(item, ordinality)
            ),
            '[]'::jsonb
          ),
          true
        ),
        updated_at = now()
      WHERE id = 'default'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(config->$1, '[]'::jsonb)) AS item
          WHERE lower(item->>'provider') = 'vertexai'
            AND lower(item->>'displayName') = lower('COTTI-专业')
            AND lower(item->>'model') = $2
        )
    `,
    [scope, SOURCE_MODEL, TARGET_MODEL],
  );
};

const replaceAgentDefault = async (client: pg.PoolClient) => {
  await client.query(
    `
      UPDATE cotti_model_display_settings
      SET
        config = jsonb_set(config, '{defaults,agent,model}', to_jsonb($2::text), false),
        updated_at = now()
      WHERE id = 'default'
        AND lower(config #>> '{defaults,agent,provider}') = 'vertexai'
        AND lower(config #>> '{defaults,agent,model}') = $1
    `,
    [SOURCE_MODEL, TARGET_MODEL],
  );
};

const replaceAgentBatch = async (client: pg.PoolClient) => {
  const result = await client.query(
    `
      WITH target AS (
        SELECT id
        FROM agents
        WHERE lower(provider) = 'vertexai' AND lower(model) = $1
        ORDER BY id
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agents
      SET model = $2, updated_at = now()
      FROM target
      WHERE agents.id = target.id
    `,
    [SOURCE_MODEL, TARGET_MODEL, AGENT_BATCH_SIZE],
  );

  return result.rowCount ?? 0;
};

const run = async () => {
  const client = await pool.connect();

  try {
    const before = await getUpgradeState(client);
    console.log(
      JSON.stringify({
        apply,
        before,
        phase: 'precheck',
        source: SOURCE_MODEL,
        target: TARGET_MODEL,
      }),
    );

    if (!apply) {
      console.log(
        JSON.stringify({
          apply,
          complete: true,
          plannedAgentUpdates: before.agentCount,
          plannedThinkingConfigUpdates: before.legacyThinkingLevelCount,
        }),
      );
      return;
    }

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [LOCK_NAME]);

    await replaceDisplayScope(client, 'chat');
    await replaceDisplayScope(client, 'agent');
    await replaceAgentDefault(client);
    const thinkingConfigsUpdated = await replaceLegacyThinkingLevels(client);

    let agentsUpdated = 0;
    while (true) {
      const batchUpdated = await replaceAgentBatch(client);
      agentsUpdated += batchUpdated;
      if (batchUpdated < AGENT_BATCH_SIZE) break;
    }

    const after = await getUpgradeState(client);
    if (
      after.agentCount ||
      after.agentDefaultCount ||
      after.displayCount ||
      after.legacyThinkingLevelCount
    ) {
      throw new Error(`Gemini 3.7 upgrade is incomplete: ${JSON.stringify(after)}`);
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify({ after, agentsUpdated, apply, complete: true, thinkingConfigsUpdated }),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => {
      console.error('Failed to roll back the Gemini 3.7 upgrade', rollbackError);
    });
    throw error;
  } finally {
    client.release();
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
