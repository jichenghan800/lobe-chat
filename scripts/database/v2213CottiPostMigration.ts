import pg from 'pg';

const { Pool } = pg;

const RECONCILIATION_MIGRATION_CREATED_AT = 1_785_724_387_923;
const apply = new Set(process.argv.slice(2)).has('--apply');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString, max: 1 });

const run = async () => {
  const client = await pool.connect();

  try {
    const migration = await client.query<{ created_at: string }>(`
      SELECT created_at::text
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const latestMigration = Number(migration.rows[0]?.created_at ?? 0);

    if (latestMigration < RECONCILIATION_MIGRATION_CREATED_AT) {
      throw new Error(
        `v2.2.13 reconciliation migration is not applied: latest created_at is ${latestMigration}`,
      );
    }

    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('topic_comments', 'topic_comment_mentions')
      ORDER BY table_name
    `);
    if (tables.rowCount !== 2) throw new Error('Topic Comment tables are missing');

    const before = await client.query<{ grant_count: string; permission_count: string }>(`
      SELECT
        (SELECT count(*)::text FROM rbac_permissions WHERE code LIKE 'topic_comment:%')
          AS permission_count,
        (
          SELECT count(*)::text
          FROM rbac_role_permissions role_permission
          JOIN rbac_permissions permission ON permission.id = role_permission.permission_id
          WHERE permission.code LIKE 'topic_comment:%'
        ) AS grant_count
    `);
    console.log(JSON.stringify({ apply, latestMigration, phase: 'precheck', ...before.rows[0] }));

    if (!apply) {
      console.log(JSON.stringify({ apply, complete: true }));
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('lobehub:v2213-cotti:post-migration'))`,
    );

    await client.query(`
      INSERT INTO rbac_permissions (id, code, name, category)
      SELECT
        substring(md5('topic-comment-rbac:' || permission.code) from 1 for 16),
        permission.code,
        permission.name,
        'topic_comment'
      FROM (
        VALUES
          ('topic_comment:read:all', 'Topic Comment Read'),
          ('topic_comment:create:all', 'Topic Comment Create'),
          ('topic_comment:update:all', 'Topic Comment Update'),
          ('topic_comment:delete:all', 'Topic Comment Delete'),
          ('topic_comment:restore:all', 'Topic Comment Restore'),
          ('topic_comment:create:owner', 'Topic Comment Create'),
          ('topic_comment:update:owner', 'Topic Comment Update'),
          ('topic_comment:delete:owner', 'Topic Comment Delete')
      ) AS permission(code, name)
      ON CONFLICT (code) DO NOTHING
    `);

    await client.query(`
      INSERT INTO rbac_role_permissions (role_id, permission_id)
      SELECT role.id, permission.id
      FROM (
        VALUES
          ('workspace_owner', true, 'topic_comment:read:all'),
          ('workspace_owner', true, 'topic_comment:create:all'),
          ('workspace_owner', true, 'topic_comment:update:all'),
          ('workspace_owner', true, 'topic_comment:delete:all'),
          ('workspace_owner', true, 'topic_comment:restore:all'),
          ('workspace_member', true, 'topic_comment:read:all'),
          ('workspace_member', true, 'topic_comment:create:owner'),
          ('workspace_member', true, 'topic_comment:update:owner'),
          ('workspace_member', true, 'topic_comment:delete:owner'),
          ('workspace_viewer', true, 'topic_comment:read:all'),
          ('super_admin', false, 'topic_comment:read:all'),
          ('super_admin', false, 'topic_comment:create:all'),
          ('super_admin', false, 'topic_comment:update:all'),
          ('super_admin', false, 'topic_comment:delete:all'),
          ('super_admin', false, 'topic_comment:restore:all')
      ) AS grant_spec(role_name, workspace_scoped, permission_code)
      JOIN rbac_roles role
        ON role.name = grant_spec.role_name
        AND (
          (grant_spec.workspace_scoped AND role.is_system = true AND role.workspace_id IS NOT NULL)
          OR (NOT grant_spec.workspace_scoped AND role.workspace_id IS NULL)
        )
      JOIN rbac_permissions permission ON permission.code = grant_spec.permission_code
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    const after = await client.query<{
      grant_count: string;
      missing_grant_count: string;
      permission_count: string;
    }>(`
      WITH expected_grants(role_name, workspace_scoped, permission_code) AS (
        VALUES
          ('workspace_owner', true, 'topic_comment:read:all'),
          ('workspace_owner', true, 'topic_comment:create:all'),
          ('workspace_owner', true, 'topic_comment:update:all'),
          ('workspace_owner', true, 'topic_comment:delete:all'),
          ('workspace_owner', true, 'topic_comment:restore:all'),
          ('workspace_member', true, 'topic_comment:read:all'),
          ('workspace_member', true, 'topic_comment:create:owner'),
          ('workspace_member', true, 'topic_comment:update:owner'),
          ('workspace_member', true, 'topic_comment:delete:owner'),
          ('workspace_viewer', true, 'topic_comment:read:all'),
          ('super_admin', false, 'topic_comment:read:all'),
          ('super_admin', false, 'topic_comment:create:all'),
          ('super_admin', false, 'topic_comment:update:all'),
          ('super_admin', false, 'topic_comment:delete:all'),
          ('super_admin', false, 'topic_comment:restore:all')
      ), applicable_grants AS (
        SELECT role.id AS role_id, permission.id AS permission_id
        FROM expected_grants grant_spec
        JOIN rbac_roles role
          ON role.name = grant_spec.role_name
          AND (
            (grant_spec.workspace_scoped AND role.is_system = true AND role.workspace_id IS NOT NULL)
            OR (NOT grant_spec.workspace_scoped AND role.workspace_id IS NULL)
          )
        JOIN rbac_permissions permission ON permission.code = grant_spec.permission_code
      )
      SELECT
        (SELECT count(*)::text FROM rbac_permissions WHERE code LIKE 'topic_comment:%')
          AS permission_count,
        (
          SELECT count(*)::text
          FROM rbac_role_permissions role_permission
          JOIN rbac_permissions permission ON permission.id = role_permission.permission_id
          WHERE permission.code LIKE 'topic_comment:%'
        ) AS grant_count,
        (
          SELECT count(*)::text
          FROM applicable_grants expected
          LEFT JOIN rbac_role_permissions actual
            ON actual.role_id = expected.role_id
            AND actual.permission_id = expected.permission_id
          WHERE actual.role_id IS NULL
        ) AS missing_grant_count
    `);

    if (Number(after.rows[0].permission_count) !== 8) {
      throw new Error(
        `Expected 8 Topic Comment permissions, got ${after.rows[0].permission_count}`,
      );
    }
    if (Number(after.rows[0].missing_grant_count) !== 0) {
      throw new Error(
        `Topic Comment role grants are incomplete: ${after.rows[0].missing_grant_count}`,
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ apply, complete: true, ...after.rows[0] }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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
