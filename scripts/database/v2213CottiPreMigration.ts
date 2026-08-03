import pg from 'pg';

const { Pool } = pg;

const BASE_MIGRATION_CREATED_AT = 1_784_687_043_746;
const RECONCILIATION_MIGRATION_CREATED_AT = 1_785_724_387_923;
const LOCK_NAME = 'lobehub:v2213-cotti:pre-migration';

const apply = new Set(process.argv.slice(2)).has('--apply');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString, max: 1 });

const getLatestMigration = async (client: pg.PoolClient) => {
  const result = await client.query<{ created_at: string }>(`
    SELECT created_at::text
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rowCount !== 1) throw new Error('No Drizzle migration history was found');

  return Number(result.rows[0].created_at);
};

const getVisibilityState = async (client: pg.PoolClient) => {
  const column = await client.query<{ column_default: string | null; is_nullable: string }>(`
    SELECT column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'devices'
      AND column_name = 'visibility'
  `);

  if (column.rowCount === 0) {
    const counts = await client.query<{
      personal_count: string;
      total_count: string;
      workspace_count: string;
    }>(`
      SELECT
        count(*)::text AS total_count,
        count(*) FILTER (WHERE workspace_id IS NOT NULL)::text AS workspace_count,
        count(*) FILTER (WHERE workspace_id IS NULL)::text AS personal_count
      FROM devices
    `);

    return {
      columnExists: false,
      columnDefault: null,
      isNullable: null,
      nullCount: Number(counts.rows[0].total_count),
      personalNullCount: Number(counts.rows[0].personal_count),
      workspaceNullCount: Number(counts.rows[0].workspace_count),
    };
  }

  const counts = await client.query<{
    null_count: string;
    personal_null_count: string;
    workspace_null_count: string;
  }>(`
    SELECT
      count(*) FILTER (WHERE visibility IS NULL)::text AS null_count,
      count(*) FILTER (WHERE visibility IS NULL AND workspace_id IS NOT NULL)::text
        AS workspace_null_count,
      count(*) FILTER (WHERE visibility IS NULL AND workspace_id IS NULL)::text
        AS personal_null_count
    FROM devices
  `);

  return {
    columnExists: true,
    columnDefault: column.rows[0].column_default,
    isNullable: column.rows[0].is_nullable === 'YES',
    nullCount: Number(counts.rows[0].null_count),
    personalNullCount: Number(counts.rows[0].personal_null_count),
    workspaceNullCount: Number(counts.rows[0].workspace_null_count),
  };
};

const assertReconciliationTablesAreAbsent = async (client: pg.PoolClient) => {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(ARRAY[
        'acceptances',
        'agent_account_bindings',
        'agent_provider_accounts',
        'agent_quota_calibrations',
        'agent_quota_snapshots',
        'agent_quota_usage_ledger',
        'agent_quota_windows',
        'resource_permissions',
        'topic_comment_mentions',
        'topic_comments',
        'verify_evidence',
        'verify_reports',
        'verify_runs',
        'work_versions',
        'works',
        'workspace_user_settings'
      ]::text[])
    ORDER BY table_name
  `);

  if (result.rowCount) {
    throw new Error(
      `Unsupported partial v2.2.13 schema detected: ${result.rows
        .map(({ table_name }) => table_name)
        .join(', ')}`,
    );
  }
};

const createHotIndexes = async (client: pg.PoolClient) => {
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS agents_created_at_idx
    ON agents USING btree (created_at)
  `);
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS topics_created_at_idx
    ON topics USING btree (created_at)
  `);
};

const run = async () => {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME]);

    const latestMigration = await getLatestMigration(client);
    if (latestMigration < BASE_MIGRATION_CREATED_AT) {
      throw new Error(`Database is behind COTTI 0118: latest created_at is ${latestMigration}`);
    }

    const before = await getVisibilityState(client);
    console.log(JSON.stringify({ apply, latestMigration, phase: 'precheck', visibility: before }));

    if (latestMigration >= RECONCILIATION_MIGRATION_CREATED_AT) {
      if (before.nullCount > 0) {
        throw new Error('Reconciled database still contains devices with NULL visibility');
      }

      if (apply) await createHotIndexes(client);
      console.log(JSON.stringify({ alreadyReconciled: true, apply, complete: true }));
      return;
    }

    if (latestMigration !== BASE_MIGRATION_CREATED_AT) {
      throw new Error(
        `Expected COTTI 0118 created_at ${BASE_MIGRATION_CREATED_AT}, got ${latestMigration}`,
      );
    }

    await assertReconciliationTablesAreAbsent(client);

    if (!apply) {
      console.log(
        JSON.stringify({
          apply,
          complete: true,
          plannedPersonalDeviceBackfill: before.personalNullCount,
          plannedWorkspaceDeviceBackfill: before.workspaceNullCount,
        }),
      );
      return;
    }

    await client.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS visibility text');

    const workspaceUpdate = await client.query(`
      UPDATE devices
      SET visibility = 'public'
      WHERE workspace_id IS NOT NULL AND visibility IS NULL
    `);
    const personalUpdate = await client.query(`
      UPDATE devices
      SET visibility = 'private'
      WHERE visibility IS NULL
    `);

    await createHotIndexes(client);

    const after = await getVisibilityState(client);
    if (after.nullCount !== 0) throw new Error('Device visibility backfill is incomplete');

    console.log(
      JSON.stringify({
        apply,
        complete: true,
        personalDevicesUpdated: personalUpdate.rowCount ?? 0,
        visibility: after,
        workspaceDevicesUpdated: workspaceUpdate.rowCount ?? 0,
      }),
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
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
