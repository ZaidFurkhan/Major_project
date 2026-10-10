import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import { createPool } from '../../src/db/pool.js';

test('select 1 returns 1 through a pool', async () => {
  const pool = await openTestPool();
  try {
    const result = await pool.query('select 1 as val;');
    assert.strictEqual(result.rows[0].val, 1);
  } finally {
    await pool.end();
  }
});

test('pool created with invalid connection rejects a query', async () => {
  const pool = createPool('postgres://user:pass@127.0.0.1:1/mechsense_test');
  try {
    await assert.rejects(async () => {
      await pool.query('select 1;');
    });
  } finally {
    await pool.end();
  }
});

test('createPool with DATABASE_URL unset throws error', async () => {
  const originalUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.throws(
      () => {
        createPool();
      },
      {
        message: 'DATABASE_URL is not set',
      }
    );
  } finally {
    process.env.DATABASE_URL = originalUrl;
  }
});
