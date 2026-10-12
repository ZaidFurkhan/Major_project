import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openTestPool } from '../helpers/testDb.js';
import { createApp } from '../../src/app.js';
import { createMachine } from '../../src/db/machines.js';
import { insertTelemetryReading } from '../../src/db/telemetryReadings.js';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

describe('telemetry REST routes', () => {
  let pool;
  let server;
  let port;

  before(async () => {
    pool = await openTestPool();
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

  it('GET /api/telemetry/:machineId/latest returns 200, reading, ageMs, and stale', async () => {
    const machine = await createMachine(pool, {
      name: 'REST Route Motor',
      type: 'brushless-dc',
    });

    const simulator = createSimulator({
      machineId: machine.id,
      scenario: 'normal',
      seed: 42,
    });
    const rawReading = simulator.next();
    const validated = validateReading(rawReading);
    assert.equal(validated.valid, true);

    await insertTelemetryReading(pool, validated.value);

    const res = await fetch(`http://127.0.0.1:${port}/api/telemetry/${machine.id}/latest`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.reading !== undefined);
    assert.equal(body.reading.machineId, machine.id);
    assert.equal(typeof body.ageMs, 'number');
    assert.equal(typeof body.stale, 'boolean');
  });

  it('returns 404 with exact error body when machine has no readings', async () => {
    const machine = await createMachine(pool, {
      name: 'Unmonitored Motor',
      type: 'stepper',
    });

    const res = await fetch(`http://127.0.0.1:${port}/api/telemetry/${machine.id}/latest`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.deepEqual(body, { error: 'no telemetry for machine' });
  });

  it('returns 400 with exact error body when machineId is malformed', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/telemetry/not-a-uuid/latest`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.deepEqual(body, { error: 'invalid machine id' });
  });

  it('GET /health still returns 200 when createApp is called with a pool', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'ok', service: 'backend' });
  });
});
