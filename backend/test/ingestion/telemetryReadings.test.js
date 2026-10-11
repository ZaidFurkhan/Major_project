import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import { createMachine } from '../../src/db/machines.js';
import {
  insertTelemetryReading,
  getLatestTelemetryReading,
} from '../../src/db/telemetryReadings.js';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

describe('telemetryReadings repository', () => {
  let pool;
  let testMachine;

  before(async () => {
    pool = await openTestPool();
    testMachine = await createMachine(pool, {
      name: 'Test Rig Motor 1',
      type: 'three-phase-induction',
      location: 'Bench A',
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE telemetry_readings RESTART IDENTITY CASCADE;');
  });

  it('inserts a valid simulated reading and returns { inserted: true, id }', async () => {
    const simulator = createSimulator({
      machineId: testMachine.id,
      scenario: 'normal',
      seed: 42,
      startTime: '2026-03-01T12:00:00.000Z',
    });
    const rawReading = simulator.next();
    const validationResult = validateReading(rawReading);
    assert.equal(validationResult.valid, true);

    const result = await insertTelemetryReading(pool, validationResult.value);
    assert.equal(result.inserted, true);
    assert.ok(result.id !== undefined && result.id !== null);
  });

  it('returns { inserted: false } when inserting the same reading again', async () => {
    const simulator = createSimulator({
      machineId: testMachine.id,
      scenario: 'normal',
      seed: 101,
      startTime: '2026-03-01T12:00:00.000Z',
    });
    const rawReading = simulator.next();
    const validationResult = validateReading(rawReading);
    assert.equal(validationResult.valid, true);

    const firstInsert = await insertTelemetryReading(pool, validationResult.value);
    assert.equal(firstInsert.inserted, true);

    const secondInsert = await insertTelemetryReading(pool, validationResult.value);
    assert.equal(secondInsert.inserted, false);
    assert.equal(secondInsert.id, undefined);
  });

  it('returns the newest of three readings inserted out of order', async () => {
    const timestamps = [
      '2026-03-01T10:00:00.000Z',
      '2026-03-01T12:00:00.000Z',
      '2026-03-01T11:00:00.000Z',
    ];

    const readings = timestamps.map((ts, idx) => ({
      machineId: testMachine.id,
      timestamp: ts,
      source: 'simulated',
      scenario: idx === 1 ? 'vibration_anomaly' : 'normal',
      temperatureC: 45.0 + idx,
      vibrationRmsG: idx === 1 ? 2.5 : 0.5,
      currentA: 5.0,
      rpm: 1500,
      commandedRpm: 1500,
      dataQuality: { windowSamples: 100, dropoutCount: idx },
    }));

    // Insert out of order: first, second (newest), third
    for (const r of readings) {
      const validated = validateReading(r);
      assert.equal(validated.valid, true);
      const res = await insertTelemetryReading(pool, validated.value);
      assert.equal(res.inserted, true);
    }

    const latest = await getLatestTelemetryReading(pool, testMachine.id);
    assert.ok(latest !== null);
    assert.equal(latest.timestamp, '2026-03-01T12:00:00.000Z');
    assert.equal(latest.source, 'simulated');
    assert.equal(latest.scenario, 'vibration_anomaly');
    assert.deepEqual(latest.dataQuality, { windowSamples: 100, dropoutCount: 1 });
    assert.equal(latest.machineId, testMachine.id);
    assert.ok(typeof latest.receivedAt === 'string');
  });

  it('returns null for a machine with no readings', async () => {
    const otherMachine = await createMachine(pool, {
      name: 'Idle Motor',
      type: 'dc-brushless',
    });

    const latest = await getLatestTelemetryReading(pool, otherMachine.id);
    assert.equal(latest, null);
  });

  it('inserts and reads back a sensor-source reading with null scenario', async () => {
    const sensorReading = {
      machineId: testMachine.id,
      timestamp: '2026-03-01T14:30:00.000Z',
      source: 'sensor',
      scenario: null,
      temperatureC: 49.2,
      vibrationRmsG: 0.35,
      currentA: 4.8,
      rpm: 1490,
      commandedRpm: null,
    };

    const validated = validateReading(sensorReading);
    assert.equal(validated.valid, true);

    const insertResult = await insertTelemetryReading(pool, validated.value);
    assert.equal(insertResult.inserted, true);

    const latest = await getLatestTelemetryReading(pool, testMachine.id);
    assert.ok(latest !== null);
    assert.equal(latest.source, 'sensor');
    assert.equal(latest.scenario, null);
    assert.equal(latest.temperatureC, 49.2);
    assert.equal(latest.vibrationRmsG, 0.35);
    assert.equal(latest.commandedRpm, null);
    assert.equal(latest.dataQuality, undefined);
  });
});
