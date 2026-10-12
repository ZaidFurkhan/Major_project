import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../../src/diagnosis/diagnose.js';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

function generateSimulatedReadings({ scenario, seed = 1, count = 20, machineId = 'test-motor', startTime }) {
  const sim = createSimulator({ machineId, scenario, seed, startTime });
  const readings = [];
  for (let i = 0; i < count; i++) {
    readings.push(sim.next());
  }
  return readings;
}

describe('diagnose', () => {
  const SEEDS = [1, 2, 3, 4, 5];

  it('diagnoses vibration_anomaly across seeds 1 to 5 with supporting candidates', () => {
    for (const seed of SEEDS) {
      const readings = generateSimulatedReadings({ scenario: 'vibration_anomaly', seed });
      const result = diagnose(readings);

      assert.equal(result.status, 'diagnosed');
      assert.ok(result.candidates.length > 0);
      const matching = result.candidates.filter((c) =>
        c.supportingSignatures.includes('vibration_elevated')
      );
      assert.ok(matching.length > 0, `Expected vibration_elevated candidate for seed ${seed}`);
      assert.deepStrictEqual(result.dataSources, ['simulated']);
      assert.ok(typeof result.uncertainty === 'string' && result.uncertainty.length > 0);
    }
  });

  it('diagnoses overheating across seeds 1 to 5 with supporting candidates', () => {
    for (const seed of SEEDS) {
      const readings = generateSimulatedReadings({ scenario: 'overheating', seed });
      const result = diagnose(readings);

      assert.equal(result.status, 'diagnosed');
      assert.ok(result.candidates.length > 0);
      const matching = result.candidates.filter((c) =>
        c.supportingSignatures.includes('overheating')
      );
      assert.ok(matching.length > 0, `Expected overheating candidate for seed ${seed}`);
      assert.deepStrictEqual(result.dataSources, ['simulated']);
      assert.ok(typeof result.uncertainty === 'string' && result.uncertainty.length > 0);
    }
  });

  it('diagnoses abnormal_load across seeds 1 to 5 with supporting candidates', () => {
    for (const seed of SEEDS) {
      const readings = generateSimulatedReadings({ scenario: 'abnormal_load', seed });
      const result = diagnose(readings);

      assert.equal(result.status, 'diagnosed');
      assert.ok(result.candidates.length > 0);
      const matching = result.candidates.filter((c) =>
        c.supportingSignatures.includes('abnormal_load')
      );
      assert.ok(matching.length > 0, `Expected abnormal_load candidate for seed ${seed}`);
      assert.deepStrictEqual(result.dataSources, ['simulated']);
      assert.ok(typeof result.uncertainty === 'string' && result.uncertainty.length > 0);
    }
  });

  it('diagnoses rpm_anomaly across seeds 1 to 5 with supporting candidates', () => {
    for (const seed of SEEDS) {
      const readings = generateSimulatedReadings({ scenario: 'rpm_anomaly', seed });
      const result = diagnose(readings);

      assert.equal(result.status, 'diagnosed');
      assert.ok(result.candidates.length > 0);
      const matching = result.candidates.filter((c) =>
        c.supportingSignatures.includes('rpm_deviation')
      );
      assert.ok(matching.length > 0, `Expected rpm_deviation candidate for seed ${seed}`);
      assert.deepStrictEqual(result.dataSources, ['simulated']);
      assert.ok(typeof result.uncertainty === 'string' && result.uncertainty.length > 0);
    }
  });

  it('returns inconclusive with empty candidates for normal scenario across seeds 1 to 5', () => {
    for (const seed of SEEDS) {
      const readings = generateSimulatedReadings({ scenario: 'normal', seed });
      const result = diagnose(readings);

      assert.equal(result.status, 'inconclusive');
      assert.equal(result.reason, 'no fault signature was detected');
      assert.deepStrictEqual(result.candidates, []);
      assert.deepStrictEqual(result.dataSources, ['simulated']);
      assert.ok(result.evidence);
      assert.equal(result.evidence.status, 'normal');
      assert.ok(typeof result.uncertainty === 'string' && result.uncertainty.length > 0);
    }
  });

  it('contradicts friction and load increase candidates when abnormal_load signature is absent', () => {
    const readings = generateSimulatedReadings({ scenario: 'overheating', seed: 1 });
    const result = diagnose(readings);

    assert.equal(result.status, 'diagnosed');
    // Precondition: abnormal_load signature must be absent
    const hasAbnormalLoad = result.signatures.some((s) => s.type === 'abnormal_load');
    assert.equal(hasAbnormalLoad, false, 'Precondition: abnormal_load must not be present');

    const frictionCandidate = result.candidates.find((c) => c.id === 'friction_candidate');
    const loadIncreaseCandidate = result.candidates.find((c) => c.id === 'load_increase_candidate');

    assert.ok(frictionCandidate, 'friction_candidate should be listed');
    assert.equal(frictionCandidate.contradicted, true);
    assert.ok(frictionCandidate.contradictions.some((c) => c.signature === 'abnormal_load'));

    assert.ok(loadIncreaseCandidate, 'load_increase_candidate should be listed');
    assert.equal(loadIncreaseCandidate.contradicted, true);
    assert.ok(loadIncreaseCandidate.contradictions.some((c) => c.signature === 'abnormal_load'));
  });

  it('orders candidates with more supporting signatures before candidates with fewer', () => {
    const readings = generateSimulatedReadings({ scenario: 'abnormal_load', seed: 1 });
    const result = diagnose(readings);

    assert.equal(result.status, 'diagnosed');
    assert.ok(result.signatures.length >= 2, 'Precondition: multiple signatures present');

    for (let i = 0; i < result.candidates.length - 1; i++) {
      const currentCount = result.candidates[i].supportingSignatures.length;
      const nextCount = result.candidates[i + 1].supportingSignatures.length;
      assert.ok(
        currentCount >= nextCount,
        `Candidate ${result.candidates[i].id} (${currentCount}) should precede ${result.candidates[i + 1].id} (${nextCount})`
      );
    }
  });

  it('ensures every candidate has non-empty checkNext and guarded phrasing in label', () => {
    const scenarios = ['vibration_anomaly', 'overheating', 'abnormal_load', 'rpm_anomaly'];
    for (const scenario of scenarios) {
      const readings = generateSimulatedReadings({ scenario, seed: 1 });
      const result = diagnose(readings);

      for (const candidate of result.candidates) {
        assert.ok(
          typeof candidate.checkNext === 'string' && candidate.checkNext.trim().length > 0,
          `Candidate ${candidate.id} missing checkNext string`
        );
        const lowerLabel = candidate.label.toLowerCase();
        const forbiddenPhrases = ['conf' + 'irmed', 'defin' + 'itely', 'is caused by'];
        for (const phrase of forbiddenPhrases) {
          assert.equal(
            lowerLabel.includes(phrase),
            false,
            `Candidate ${candidate.id} label should not contain forbidden phrase: ${phrase}`
          );
        }
      }
    }
  });

  it('passes through insufficient_data and keeps detector fields with empty candidates', () => {
    const readings = generateSimulatedReadings({ scenario: 'normal', seed: 1, count: 12 });
    const result = diagnose(readings, { baselineCount: 10, windowCount: 10 });

    assert.equal(result.status, 'insufficient_data');
    assert.equal(result.required, 20);
    assert.equal(result.received, 12);
    assert.deepStrictEqual(result.signatures, []);
    assert.deepStrictEqual(result.candidates, []);
  });

  it('passes through invalid_input and keeps detector fields with empty candidates', () => {
    const nonArrayResult = diagnose('invalid-input');
    assert.equal(nonArrayResult.status, 'invalid_input');
    assert.ok(Array.isArray(nonArrayResult.errors));
    assert.deepStrictEqual(nonArrayResult.candidates, []);
    assert.deepStrictEqual(nonArrayResult.dataSources, []);

    const validReadings = generateSimulatedReadings({ scenario: 'normal', seed: 1, count: 20 });
    validReadings[4] = { ...validReadings[4], currentA: -5 }; // Invalid negative current

    const corruptResult = diagnose(validReadings);
    assert.equal(corruptResult.status, 'invalid_input');
    assert.ok(corruptResult.errors.some((err) => err.includes('index 4')));
    assert.deepStrictEqual(corruptResult.candidates, []);
  });

  it('is deterministic and does not mutate the input readings array', () => {
    const readings = generateSimulatedReadings({ scenario: 'vibration_anomaly', seed: 2 });
    const originalDeepCopy = JSON.parse(JSON.stringify(readings));

    const result1 = diagnose(readings);
    const result2 = diagnose(readings);

    assert.deepStrictEqual(result1, result2);
    assert.deepStrictEqual(readings, originalDeepCopy, 'Input array must remain unmodified');
  });

  it('reports dataSources as sensor when all readings have sensor source', () => {
    const sim = createSimulator({ machineId: 'bench-motor-01', scenario: 'normal', seed: 10 });
    const sensorReadings = [];
    for (let i = 0; i < 20; i++) {
      const raw = sim.next();
      const sensorCopy = {
        ...raw,
        source: 'sensor',
        scenario: null,
      };
      const validation = validateReading(sensorCopy);
      assert.equal(validation.valid, true);
      sensorReadings.push(validation.value);
    }

    const result = diagnose(sensorReadings);
    assert.deepStrictEqual(result.dataSources, ['sensor']);
  });

  it('includes the uncertainty statement on every diagnosed and inconclusive result', () => {
    const normalReadings = generateSimulatedReadings({ scenario: 'normal', seed: 1 });
    const inconclusiveResult = diagnose(normalReadings);
    assert.equal(typeof inconclusiveResult.uncertainty, 'string');
    assert.ok(inconclusiveResult.uncertainty.length > 0);

    const anomalousReadings = generateSimulatedReadings({ scenario: 'overheating', seed: 1 });
    const diagnosedResult = diagnose(anomalousReadings);
    assert.equal(typeof diagnosedResult.uncertainty, 'string');
    assert.ok(diagnosedResult.uncertainty.length > 0);
    assert.equal(diagnosedResult.uncertainty, inconclusiveResult.uncertainty);
  });
});
