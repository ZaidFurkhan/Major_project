import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateScenarioWindow } from '../../src/simulator/fixtures.js';
import { createSimulator } from '../../src/simulator/simulator.js';

describe('generateScenarioWindow', () => {
  it('returns exactly count readings', () => {
    const readings = generateScenarioWindow({
      machineId: 'motor-X',
      scenario: 'normal',
      seed: 77,
      count: 25,
    });
    assert.equal(readings.length, 25);
  });

  it('matches createSimulator output for the same inputs', () => {
    const opts = { machineId: 'motor-X', scenario: 'overheating', seed: 42 };
    const count = 30;

    const fromFixtures = generateScenarioWindow({ ...opts, count });
    const sim = createSimulator(opts);
    const fromSimulator = Array.from({ length: count }, () => sim.next());

    assert.deepStrictEqual(fromFixtures, fromSimulator);
  });
});
