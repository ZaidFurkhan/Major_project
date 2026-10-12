import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies } from '../../src/analysis/anomalyDetector.js';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

function generateReadings({ machineId = 'motor-test', scenario, seed, count, startTime }) {
  const sim = createSimulator({ machineId, scenario, seed, startTime });
  const readings = [];
  for (let i = 0; i < count; i++) {
    readings.push(sim.next());
  }
  return readings;
}

describe('anomalyDetector', () => {
  const SEEDS = [1, 2, 3, 4, 5];

  it('detects vibration_elevated in vibration_anomaly scenario for seeds 1 to 5', () => {
    for (const seed of SEEDS) {
      const readings = generateReadings({ scenario: 'vibration_anomaly', seed, count: 20 });
      const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

      assert.equal(result.status, 'anomalous');
      const signature = result.signatures.find((s) => s.type === 'vibration_elevated');
      assert.ok(signature, `Expected vibration_elevated for seed ${seed}`);
      assert.ok(typeof signature.evidence.baselineMean === 'number');
      assert.ok(typeof signature.evidence.windowMean === 'number');
      assert.ok(typeof signature.evidence.ratio === 'number');
      assert.ok(signature.evidence.ratio > 1.0);
    }
  });

  it('detects overheating in overheating scenario for seeds 1 to 5', () => {
    for (const seed of SEEDS) {
      const readings = generateReadings({ scenario: 'overheating', seed, count: 20 });
      const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

      assert.equal(result.status, 'anomalous');
      const signature = result.signatures.find((s) => s.type === 'overheating');
      assert.ok(signature, `Expected overheating for seed ${seed}`);
      assert.ok(typeof signature.evidence.baselineMean === 'number');
      assert.ok(typeof signature.evidence.windowMean === 'number');
      assert.ok(signature.evidence.riseInC > 0);
    }
  });

  it('detects abnormal_load in abnormal_load scenario for seeds 1 to 5 and reports both current and rpm evidence', () => {
    for (const seed of SEEDS) {
      const readings = generateReadings({ scenario: 'abnormal_load', seed, count: 20 });
      const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

      assert.equal(result.status, 'anomalous');
      const signature = result.signatures.find((s) => s.type === 'abnormal_load');
      assert.ok(signature, `Expected abnormal_load for seed ${seed}`);

      // Evidence must contain both current and rpm measurements
      assert.ok(typeof signature.evidence.baselineCurrentMean === 'number');
      assert.ok(typeof signature.evidence.windowCurrentMean === 'number');
      assert.ok(typeof signature.evidence.baselineRpmMean === 'number');
      assert.ok(typeof signature.evidence.windowRpmMean === 'number');
      assert.ok(signature.evidence.windowCurrentMean > signature.evidence.baselineCurrentMean);
      assert.ok(signature.evidence.windowRpmMean < signature.evidence.baselineRpmMean);
    }
  });

  it('detects rpm_deviation in rpm_anomaly scenario for seeds 1 to 5', () => {
    for (const seed of SEEDS) {
      const readings = generateReadings({ scenario: 'rpm_anomaly', seed, count: 20 });
      const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

      assert.equal(result.status, 'anomalous');
      const signature = result.signatures.find((s) => s.type === 'rpm_deviation');
      assert.ok(signature, `Expected rpm_deviation for seed ${seed}`);
      assert.ok(typeof signature.evidence.meanAbsoluteDifference === 'number');
      assert.ok(typeof signature.evidence.windowMeanCommandedRpm === 'number');
      assert.ok(typeof signature.evidence.excludedCount === 'number');
      assert.equal(signature.evidence.excludedCount, 0);
    }
  });

  it('reports normal status and no signatures for normal scenario across seeds 1 to 5', () => {
    for (const seed of SEEDS) {
      const readings = generateReadings({ scenario: 'normal', seed, count: 20 });
      const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

      assert.equal(result.status, 'normal');
      assert.deepStrictEqual(result.signatures, []);
      assert.ok(result.baseline);
      assert.ok(result.window);
    }
  });

  it('returns insufficient_data when fewer than required readings are provided', () => {
    const readings = generateReadings({ scenario: 'normal', seed: 1, count: 15 });
    const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });

    assert.equal(result.status, 'insufficient_data');
    assert.equal(result.required, 20);
    assert.equal(result.received, 15);
    assert.deepStrictEqual(result.signatures, []);
  });

  it('returns invalid_input for non-array input', () => {
    const notArray = detectAnomalies('not an array');
    assert.equal(notArray.status, 'invalid_input');
    assert.ok(Array.isArray(notArray.errors));
    assert.deepStrictEqual(notArray.signatures, []);

    const nullInput = detectAnomalies(null);
    assert.equal(nullInput.status, 'invalid_input');
    assert.ok(Array.isArray(nullInput.errors));
    assert.deepStrictEqual(nullInput.signatures, []);
  });

  it('returns invalid_input for baselineCount less than 1 or non-integer', () => {
    const readings = generateReadings({ scenario: 'normal', seed: 1, count: 20 });

    const zeroBaseline = detectAnomalies(readings, { baselineCount: 0, windowCount: 10 });
    assert.equal(zeroBaseline.status, 'invalid_input');
    assert.ok(zeroBaseline.errors.some((e) => e.includes('baselineCount')));

    const floatBaseline = detectAnomalies(readings, { baselineCount: 5.5, windowCount: 10 });
    assert.equal(floatBaseline.status, 'invalid_input');
    assert.ok(floatBaseline.errors.some((e) => e.includes('baselineCount')));

    const zeroWindow = detectAnomalies(readings, { baselineCount: 10, windowCount: 0 });
    assert.equal(zeroWindow.status, 'invalid_input');
    assert.ok(zeroWindow.errors.some((e) => e.includes('windowCount')));
  });

  it('returns invalid_input when a reading fails validateReading and names the invalid index', () => {
    const readings = generateReadings({ scenario: 'normal', seed: 1, count: 20 });
    // Corrupt reading at index 3
    readings[3] = { ...readings[3], temperatureC: 'invalid-temp' };

    const result = detectAnomalies(readings);
    assert.equal(result.status, 'invalid_input');
    assert.ok(Array.isArray(result.errors));
    assert.ok(
      result.errors.some((err) => err.includes('index 3')),
      'Expected error to identify index 3'
    );
  });

  it('is deterministic and does not mutate the input array', () => {
    const readings = generateReadings({ scenario: 'vibration_anomaly', seed: 1, count: 20 });
    const originalCopy = JSON.parse(JSON.stringify(readings));

    const result1 = detectAnomalies(readings);
    const result2 = detectAnomalies(readings);

    assert.deepStrictEqual(result1, result2);
    assert.deepStrictEqual(readings, originalCopy, 'Input array must not be mutated');
  });

  it('treats the baseline window of progressive scenarios as pure normal operation', () => {
    const progressiveScenarios = [
      'vibration_anomaly',
      'overheating',
      'abnormal_load',
      'rpm_anomaly',
    ];

    for (const scenario of progressiveScenarios) {
      for (const seed of SEEDS) {
        // Generate only the baseline 10 readings (steps 0 to 9)
        const baselineReadings = generateReadings({ scenario, seed, count: 10 });

        // Evaluate baseline alone using 5 earliest as baseline and 5 latest as window
        const result = detectAnomalies(baselineReadings, { baselineCount: 5, windowCount: 5 });

        assert.equal(
          result.status,
          'normal',
          `${scenario} baseline for seed ${seed} should be normal operation`
        );
        assert.deepStrictEqual(
          result.signatures,
          [],
          `${scenario} baseline for seed ${seed} should produce no fault signatures`
        );
      }
    }
  });

  it('excludes null commandedRpm readings and does not fire rpm_deviation if all are null', () => {
    const readings = generateReadings({ scenario: 'rpm_anomaly', seed: 1, count: 20 });
    // Set all commandedRpm to null in window
    for (let i = 10; i < 20; i++) {
      readings[i] = { ...readings[i], commandedRpm: null };
    }

    const result = detectAnomalies(readings, { baselineCount: 10, windowCount: 10 });
    const rpmSig = result.signatures.find((s) => s.type === 'rpm_deviation');
    assert.equal(rpmSig, undefined, 'rpm_deviation should not fire when all commandedRpm are null');
  });
});
