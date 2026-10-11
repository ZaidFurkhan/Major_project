import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateScenarioWindow } from '../../src/simulator/fixtures.js';
import { validateReading } from '../../src/telemetry/contract.js';

function mean(arr, key) {
  return arr.reduce((sum, r) => sum + r[key], 0) / arr.length;
}

function withinPercent(actual, baseline, pct) {
  // For near-zero baselines, use an absolute tolerance instead
  if (Math.abs(baseline) < 0.01) {
    return Math.abs(actual - baseline) < 1.0;
  }
  return Math.abs(actual - baseline) / Math.abs(baseline) <= pct / 100;
}

describe('scenario behavior', () => {
  const SEED = 42;
  const MACHINE = 'test-motor';
  const COUNT = 60;

  function generateAndSplit(scenario) {
    const readings = generateScenarioWindow({ machineId: MACHINE, scenario, seed: SEED, count: COUNT });
    const baseline = readings.slice(0, 10);
    const late = readings.slice(50, 60);
    return { readings, baseline, late };
  }

  it('every reading in every scenario passes validateReading', () => {
    const scenarios = ['normal', 'vibration_anomaly', 'overheating', 'abnormal_load', 'rpm_anomaly'];
    for (const scenario of scenarios) {
      const readings = generateScenarioWindow({ machineId: MACHINE, scenario, seed: SEED, count: COUNT });
      for (let i = 0; i < readings.length; i++) {
        const result = validateReading(readings[i]);
        assert.equal(result.valid, true, `${scenario} reading ${i}: ${result.errors?.join('; ')}`);
      }
    }
  });

  it('normal: every channel late mean is within 5% of baseline mean', () => {
    const { baseline, late } = generateAndSplit('normal');

    for (const key of ['temperatureC', 'vibrationRmsG', 'currentA', 'rpm']) {
      const bMean = mean(baseline, key);
      const lMean = mean(late, key);
      assert.ok(
        withinPercent(lMean, bMean, 5),
        `normal: ${key} late mean ${lMean.toFixed(4)} not within 5% of baseline ${bMean.toFixed(4)}`
      );
    }
  });

  it('vibration_anomaly: late vibrationRmsG mean exceeds baseline by at least 50%; temperatureC stable', () => {
    const { baseline, late } = generateAndSplit('vibration_anomaly');

    const bVib = mean(baseline, 'vibrationRmsG');
    const lVib = mean(late, 'vibrationRmsG');
    assert.ok(
      lVib >= bVib * 1.5,
      `vibration_anomaly: late vibrationRmsG mean ${lVib.toFixed(4)} should be >= 1.5x baseline ${bVib.toFixed(4)}`
    );

    const bTemp = mean(baseline, 'temperatureC');
    const lTemp = mean(late, 'temperatureC');
    assert.ok(
      withinPercent(lTemp, bTemp, 5),
      `vibration_anomaly: late temperatureC mean ${lTemp.toFixed(4)} not within 5% of baseline ${bTemp.toFixed(4)}`
    );
  });

  it('overheating: late temperatureC mean exceeds baseline by at least 10°C; temperatureC is non-decreasing', () => {
    const { readings, baseline, late } = generateAndSplit('overheating');

    const bTemp = mean(baseline, 'temperatureC');
    const lTemp = mean(late, 'temperatureC');
    assert.ok(
      lTemp >= bTemp + 10,
      `overheating: late temp mean ${lTemp.toFixed(2)} should exceed baseline ${bTemp.toFixed(2)} by >= 10°C`
    );

    // Temperature should be non-decreasing across the window
    for (let i = 1; i < readings.length; i++) {
      assert.ok(
        readings[i].temperatureC >= readings[i - 1].temperatureC - 0.001,
        `overheating: temperature decreased at step ${i}: ${readings[i - 1].temperatureC} -> ${readings[i].temperatureC}`
      );
    }
  });

  it('abnormal_load: late currentA mean exceeds baseline by at least 20%; late rpm is lower than baseline', () => {
    const { baseline, late } = generateAndSplit('abnormal_load');

    const bCurrent = mean(baseline, 'currentA');
    const lCurrent = mean(late, 'currentA');
    assert.ok(
      lCurrent >= bCurrent * 1.2,
      `abnormal_load: late currentA mean ${lCurrent.toFixed(4)} should be >= 1.2x baseline ${bCurrent.toFixed(4)}`
    );

    const bRpm = mean(baseline, 'rpm');
    const lRpm = mean(late, 'rpm');
    assert.ok(
      lRpm < bRpm,
      `abnormal_load: late rpm mean ${lRpm.toFixed(2)} should be lower than baseline ${bRpm.toFixed(2)}`
    );
  });

  it('rpm_anomaly: mean |rpm - commandedRpm| over late window is >= 5% of commandedRpm mean', () => {
    const { late } = generateAndSplit('rpm_anomaly');

    const commandedMean = mean(late, 'commandedRpm');
    const absDeviation =
      late.reduce((sum, r) => sum + Math.abs(r.rpm - r.commandedRpm), 0) / late.length;

    assert.ok(
      absDeviation >= 0.05 * commandedMean,
      `rpm_anomaly: mean |rpm - commandedRpm| = ${absDeviation.toFixed(2)} should be >= 5% of commandedRpm mean ${commandedMean.toFixed(2)}`
    );
  });
});
