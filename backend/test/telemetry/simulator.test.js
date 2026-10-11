import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

describe('createSimulator', () => {
  it('produces identical 50-reading sequences for the same seed and startTime', () => {
    const opts = { machineId: 'motor-A', scenario: 'normal', seed: 42, startTime: '2026-03-01T00:00:00.000Z' };
    const sim1 = createSimulator(opts);
    const sim2 = createSimulator(opts);

    const seq1 = Array.from({ length: 50 }, () => sim1.next());
    const seq2 = Array.from({ length: 50 }, () => sim2.next());

    assert.deepStrictEqual(seq1, seq2);
  });

  it('produces different sequences for different seeds', () => {
    const base = { machineId: 'motor-A', scenario: 'normal', startTime: '2026-03-01T00:00:00.000Z' };
    const sim1 = createSimulator({ ...base, seed: 1 });
    const sim2 = createSimulator({ ...base, seed: 2 });

    const seq1 = Array.from({ length: 10 }, () => sim1.next());
    const seq2 = Array.from({ length: 10 }, () => sim2.next());

    const same = seq1.every((r, i) => r.temperatureC === seq2[i].temperatureC);
    assert.equal(same, false, 'different seeds should produce different values');
  });

  it('advances timestamps by exactly 1000 ms per reading', () => {
    const sim = createSimulator({ machineId: 'motor-A', scenario: 'normal', seed: 7, startTime: '2026-01-01T00:00:00.000Z' });
    const readings = Array.from({ length: 20 }, () => sim.next());

    for (let i = 1; i < readings.length; i++) {
      const prev = new Date(readings[i - 1].timestamp).getTime();
      const curr = new Date(readings[i].timestamp).getTime();
      assert.equal(curr - prev, 1000, `step ${i}: expected 1000ms gap`);
    }
  });

  it('every reading passes validateReading', () => {
    const sim = createSimulator({ machineId: 'motor-A', scenario: 'normal', seed: 99 });
    for (let i = 0; i < 100; i++) {
      const reading = sim.next();
      const result = validateReading(reading);
      assert.equal(result.valid, true, `reading ${i} invalid: ${result.errors?.join('; ')}`);
    }
  });

  it('throws for an unknown scenario', () => {
    assert.throws(
      () => createSimulator({ machineId: 'motor-A', scenario: 'explosion', seed: 1 }),
      { message: /scenario must be one of/ }
    );
  });

  it('throws for an empty machineId', () => {
    assert.throws(
      () => createSimulator({ machineId: '', scenario: 'normal', seed: 1 }),
      { message: /machineId must be a non-empty string/ }
    );
  });

  it('throws for a malformed startTime', () => {
    assert.throws(
      () => createSimulator({ machineId: 'motor-A', scenario: 'normal', seed: 1, startTime: 'not-a-date' }),
      { message: /startTime/ }
    );
  });

  it('uses the documented default startTime when none is provided', () => {
    const sim = createSimulator({ machineId: 'motor-A', scenario: 'normal', seed: 10 });
    const reading = sim.next();
    assert.equal(reading.timestamp, '2026-01-01T00:00:00.000Z');
  });
});
