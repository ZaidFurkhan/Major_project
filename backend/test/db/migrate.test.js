import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTestPool } from '../helpers/testDb.js';
import { runMigrations } from '../../src/db/migrate.js';

test('runMigrations runs cleanly, idempotently, and creates tables', async () => {
  const pool = await openTestPool();
  try {
    const migrationsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../database/migrations'
    );

    const firstRun = await runMigrations(pool, migrationsDir);
    assert.ok(Array.isArray(firstRun));
    if (firstRun.length > 0) {
      assert.ok(firstRun.includes('0001_initial_schema.sql'));
    }

    const secondRun = await runMigrations(pool, migrationsDir);
    assert.deepStrictEqual(secondRun, []);

    const res = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name in ('machines', 'service_cases');
    `);
    const tableNames = res.rows.map((r) => r.table_name);
    assert.ok(tableNames.includes('machines'));
    assert.ok(tableNames.includes('service_cases'));
  } finally {
    await pool.end();
  }
});
