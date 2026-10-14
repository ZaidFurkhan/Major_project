import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openTestPool } from '../helpers/testDb.js';
import { createApp } from '../../src/app.js';
import { createMachine } from '../../src/db/machines.js';
import { createServiceCase } from '../../src/db/serviceCases.js';
import { insertVerificationResult } from '../../src/db/verificationResults.js';

describe('case report REST routes', () => {
  let pool;
  let server;
  let port;
  let machine;
  let serviceCase;

  before(async () => {
    pool = await openTestPool();
    await pool.query(
      'TRUNCATE verification_results, service_cases, machines RESTART IDENTITY CASCADE;'
    );

    machine = await createMachine(pool, {
      name: 'TEST FIXTURE: Report Test Motor',
      type: 'TEST FIXTURE: induction',
      location: 'TEST FIXTURE: Bay 3',
    });

    serviceCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Vibration warning symptom',
    });

    await insertVerificationResult(pool, {
      serviceCaseId: serviceCase.id,
      targetSignature: 'vibration_elevated',
      status: 'PASS',
      reason: 'TEST FIXTURE: no fault signature in post-repair window relative to baseline',
      detectedSignatures: [],
      evidence: { baseline: {}, window: {}, signatures: [] },
      uncertainty: 'TEST FIXTURE: compares post-repair readings with supplied baseline only',
    });

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

  it('GET with an existing case with a PASS verification returns 200 and repairOutcome verified', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/cases/${serviceCase.id}/report`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.case.id, serviceCase.id);
    assert.equal(body.machine.id, machine.id);
    assert.equal(body.repairOutcome, 'verified');
    assert.ok(body.latestVerification);
    assert.equal(body.latestVerification.status, 'PASS');
    assert.ok(Array.isArray(body.notes));
  });

  it('GET for a random UUID returns 404 with the exact error body', async () => {
    const randomUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`http://127.0.0.1:${port}/api/cases/${randomUuid}/report`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.deepEqual(body, { error: 'case not found' });
  });

  it('GET with not-a-uuid returns 400 with the exact error body', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/cases/not-a-uuid/report`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.deepEqual(body, { error: 'invalid case id' });
  });

  it('GET with ?format=text returns text/plain containing the case id', async () => {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/cases/${serviceCase.id}/report?format=text`
    );
    assert.equal(res.status, 200);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('text/plain'));

    const text = await res.text();
    assert.ok(text.includes(serviceCase.id));
    assert.ok(text.includes('Repair Outcome: verified'));
    assert.ok(text.includes(machine.name));
  });

  it('GET /health still returns 200 when createApp is called with a pool', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'ok', service: 'backend' });
  });
});
