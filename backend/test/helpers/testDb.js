import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../../src/db/pool.js';
import { runMigrations } from '../../src/db/migrate.js';

export async function openTestPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsedUrl = new URL(url);
  const databaseName = parsedUrl.pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error('Refusing to run tests: database name must end in _test');
  }

  const pool = createPool(url);

  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../database/migrations'
  );

  await runMigrations(pool, migrationsDir);
  await pool.query('TRUNCATE service_cases, machines RESTART IDENTITY CASCADE;');

  return pool;
}
