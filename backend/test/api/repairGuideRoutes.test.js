import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openTestPool } from '../helpers/testDb.js';
import { createApp } from '../../src/app.js';
import {
  createRepairProcedure,
  addRepairStep,
  approveRepairProcedure,
} from '../../src/db/repairProcedures.js';
import { ALLOWED_FAULT_SIGNATURES } from '../../src/repair/guide.js';

describe('repair guide REST routes', () => {
  let pool;
  let server;
  let port;

  before(async () => {
    pool = await openTestPool();
    await pool.query('TRUNCATE repair_steps, repair_procedures RESTART IDENTITY CASCADE;');

    const app = createApp({ pool });
    server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve);
      server.on('error', reject);
    });

    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (pool) {
      await pool.end();
    }
  });

  it('GET with an approved fixture returns 200 and the exact found body shape', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'overheating',
      title: 'TEST FIXTURE: Overheating remediation route test',
      sourceReference: 'Standard Ref H',
    });

    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Check ventilation airflow',
      sourceLocation: 'Section 2.1',
    });

    const approved = await approveRepairProcedure(pool, procedure.id);
    assert.ok(approved);

    const res = await fetch(`http://127.0.0.1:${port}/api/repair-guide/overheating`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, {
      status: 'found',
      faultSignature: 'overheating',
      procedure: {
        id: procedure.id,
        title: 'TEST FIXTURE: Overheating remediation route test',
        sourceReference: 'Standard Ref H',
        approvedAt: approved.approvedAt.toISOString(),
      },
      steps: [
        {
          stepOrder: 1,
          instruction: 'TEST FIXTURE: Check ventilation airflow',
          sourceLocation: 'Section 2.1',
        },
      ],
    });
  });

  it('GET with an unapproved signature returns 404 with the exact error body', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/repair-guide/rpm_deviation`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.deepEqual(body, {
      error: 'no approved procedure for signature',
    });
  });

  it('GET with not-a-signature returns 400 with the exact error body and the allowed list', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/repair-guide/not-a-signature`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.deepEqual(body, {
      error: 'invalid fault signature',
      allowed: ALLOWED_FAULT_SIGNATURES,
    });
  });

  it('GET /health still returns 200 when createApp is called with a pool', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'ok', service: 'backend' });
  });
});
