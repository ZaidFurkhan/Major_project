import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator } from '../../src/simulator/simulator.js';
import { generateScenarioWindow } from '../../src/simulator/fixtures.js';
import { verifyRepair } from '../../src/verification/verifyRepair.js';

const EXPECTED_UNCERTAINTY =
  'This decision compares post-repair readings with the supplied baseline only. It does not prove the cause was repaired, and simulated readings must not be used for a real machine decision.';

function generateReadings(sim, count) {
  const readings = [];
  for (let i = 0; i < count; i++) {
    readings.push(sim.next());
  }
  return readings;
}

describe('repair verification decision module', () => {
  it('returns PASS and empty detectedSignatures when post-repair readings are normal', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairSim = createSimulator({
      machineId: 'test-motor',
      scenario: 'normal',
      seed: 2,
      startTime: '2026-01-01T01:00:00.000Z',
    });
    const postRepairReadings = generateReadings(postRepairSim, 20);

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'vibration_elevated',
    });

    assert.equal(result.status, 'PASS');
    assert.equal(result.reason, 'no fault signature in post-repair window relative to baseline');
    assert.equal(result.targetSignature, 'vibration_elevated');
    assert.deepEqual(result.detectedSignatures, []);
    assert.ok(result.evidence);
    assert.ok(result.evidence.baseline);
    assert.ok(result.evidence.window);
    assert.deepEqual(result.evidence.signatures, []);
    assert.equal(result.uncertainty, EXPECTED_UNCERTAINTY);
  });

  it('returns FAIL when target signature vibration_elevated is still detected in post-repair window', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairReadings = generateScenarioWindow({
      machineId: 'test-motor',
      scenario: 'vibration_anomaly',
      seed: 3,
      count: 60,
    }).slice(-20);

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'vibration_elevated',
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(result.reason, 'target fault still present after repair');
    assert.equal(result.targetSignature, 'vibration_elevated');
    assert.deepEqual(result.detectedSignatures, ['vibration_elevated']);
    assert.equal(result.uncertainty, EXPECTED_UNCERTAINTY);
  });

  it('returns INCONCLUSIVE when a different signature appears post-repair', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairReadings = generateScenarioWindow({
      machineId: 'test-motor',
      scenario: 'vibration_anomaly',
      seed: 3,
      count: 60,
    }).slice(-20);

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'rpm_deviation',
    });

    assert.equal(result.status, 'INCONCLUSIVE');
    assert.equal(
      result.reason,
      'a different fault signature appeared after repair; inspection required'
    );
    assert.equal(result.targetSignature, 'rpm_deviation');
    assert.deepEqual(result.detectedSignatures, ['vibration_elevated']);
    assert.equal(result.uncertainty, EXPECTED_UNCERTAINTY);
  });

  it('returns FAIL when target signature overheating is still present in post-repair window', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairReadings = generateScenarioWindow({
      machineId: 'test-motor',
      scenario: 'overheating',
      seed: 4,
      count: 60,
    }).slice(-20);

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'overheating',
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(result.reason, 'target fault still present after repair');
    assert.equal(result.targetSignature, 'overheating');
    assert.deepEqual(result.detectedSignatures, ['overheating']);
    assert.equal(result.uncertainty, EXPECTED_UNCERTAINTY);
  });

  it('returns INCONCLUSIVE with reason insufficient readings when post-repair readings are fewer than 10', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 2 });
    const postRepairReadings = generateReadings(postRepairSim, 8);

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'vibration_elevated',
    });

    assert.equal(result.status, 'INCONCLUSIVE');
    assert.equal(result.reason, 'insufficient readings');
    assert.deepEqual(result.required, { baseline: 10, postRepair: 10 });
    assert.deepEqual(result.received, { baseline: 20, postRepair: 8 });
    assert.deepEqual(result.signatures, []);
  });

  it('returns invalid_input for non-array input and unknown targetSignature', () => {
    const invalidInputsResult = verifyRepair({
      baselineReadings: 'not-an-array',
      postRepairReadings: null,
      targetSignature: 'unknown_fault_signature',
    });

    assert.equal(invalidInputsResult.status, 'invalid_input');
    assert.ok(Array.isArray(invalidInputsResult.errors));
    assert.ok(
      invalidInputsResult.errors.some((err) => err.includes('baselineReadings must be an array'))
    );
    assert.ok(
      invalidInputsResult.errors.some((err) => err.includes('postRepairReadings must be an array'))
    );
    assert.ok(
      invalidInputsResult.errors.some((err) => err.includes('targetSignature must be one of'))
    );
  });

  it('returns invalid_input naming postRepairReadings and the index when a reading fails validateReading', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 15);

    const postRepairSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 2 });
    const postRepairReadings = generateReadings(postRepairSim, 15);

    // Corrupt one reading in postRepairReadings
    postRepairReadings[5] = {
      ...postRepairReadings[5],
      temperatureC: 250, // Invalid: exceeds max range
    };

    const result = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'overheating',
    });

    assert.equal(result.status, 'invalid_input');
    assert.ok(Array.isArray(result.errors));
    assert.ok(
      result.errors.some(
        (err) => err.includes('postRepairReadings') && err.includes('index 5')
      )
    );
  });

  it('is deterministic and does not mutate input arrays', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const postRepairReadings = generateScenarioWindow({
      machineId: 'test-motor',
      scenario: 'vibration_anomaly',
      seed: 3,
      count: 60,
    }).slice(-20);

    const baselineCopy = JSON.parse(JSON.stringify(baselineReadings));
    const postRepairCopy = JSON.parse(JSON.stringify(postRepairReadings));

    const result1 = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'vibration_elevated',
    });
    const result2 = verifyRepair({
      baselineReadings,
      postRepairReadings,
      targetSignature: 'vibration_elevated',
    });

    assert.deepEqual(result1, result2);
    assert.deepEqual(baselineReadings, baselineCopy, 'baselineReadings must not be mutated');
    assert.deepEqual(postRepairReadings, postRepairCopy, 'postRepairReadings must not be mutated');
  });

  it('every decision result includes the exact uncertainty string', () => {
    const baselineSim = createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 1 });
    const baselineReadings = generateReadings(baselineSim, 20);

    const normalPost = generateReadings(
      createSimulator({ machineId: 'test-motor', scenario: 'normal', seed: 2 }),
      20
    );
    const passResult = verifyRepair({
      baselineReadings,
      postRepairReadings: normalPost,
      targetSignature: 'vibration_elevated',
    });

    const vibPost = generateScenarioWindow({
      machineId: 'test-motor',
      scenario: 'vibration_anomaly',
      seed: 3,
      count: 60,
    }).slice(-20);

    const failResult = verifyRepair({
      baselineReadings,
      postRepairReadings: vibPost,
      targetSignature: 'vibration_elevated',
    });

    const diffResult = verifyRepair({
      baselineReadings,
      postRepairReadings: vibPost,
      targetSignature: 'rpm_deviation',
    });

    assert.equal(passResult.uncertainty, EXPECTED_UNCERTAINTY);
    assert.equal(failResult.uncertainty, EXPECTED_UNCERTAINTY);
    assert.equal(diffResult.uncertainty, EXPECTED_UNCERTAINTY);
  });
});
