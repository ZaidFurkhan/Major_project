import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

export async function runMigrations(pool, migrationsDir) {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();

  const appliedResult = await pool.query('select filename from schema_migrations;');
  const appliedSet = new Set(appliedResult.rows.map((r) => r.filename));

  const appliedInThisRun = [];

  for (const file of sqlFiles) {
    if (!appliedSet.has(file)) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1);', [file]);
        await client.query('COMMIT');
        appliedInThisRun.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  return appliedInThisRun;
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFilePath && invokedFilePath === currentFilePath) {
  let pool;
  try {
    pool = createPool(process.env.DATABASE_URL);
    const migrationsDir = path.resolve(path.dirname(currentFilePath), '../../../database/migrations');
    const applied = await runMigrations(pool, migrationsDir);

    if (applied.length === 0) {
      console.log('no pending migrations');
    } else {
      for (const filename of applied) {
        console.log(`applied ${filename}`);
      }
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    if (pool) {
      try {
        await pool.end();
      } catch {
        // Ignore pool close error on exit
      }
    }
    process.exit(1);
  }
}
