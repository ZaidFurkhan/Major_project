import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateReading, SOURCE_TYPES, SCENARIOS } from '../../src/telemetry/contract.js';

function validSimulatedReading(overrides = {}) {
  return {
    machineId: 'machine-001',
    timestamp: '2026-06-15T10:30:00.000+05:30',
    source: 'simulated',
    scenario: 'normal',
    temperatureC: 45,
    vibrationRmsG: 0.5,
    currentA: 5.0,
    rpm: 1500,
    commandedRpm: 1500,
    dataQuality: { windowSamples: 100, dropoutCount: 2 },
    ...overrides,
  };
}

function validSensorReading(overrides = {}) {
  return {
    machineId: 'machine-002',
    timestamp: '2026-06-15T10:30:00.000Z',
    source: 'sensor',
    temperatureC: 50,
    vibrationRmsG: 0.3,
    currentA: 4.0,
    rpm: 1480,
    commandedRpm: null,
    ...overrides,
  };
}

describe('validateReading', () => {
  it('accepts a complete valid simulated reading and normalizes timestamp to UTC', () => {
    const result = validateReading(validSimulatedReading());
    assert.equal(result.valid, true);
    assert.equal(result.value.timestamp, '2026-06-15T05:00:00.000Z');
    assert.equal(result.value.source, 'simulated');
    assert.equal(result.value.scenario, 'normal');
  });

  it('accepts a complete valid sensor reading without scenario', () => {
    const result = validateReading(validSensorReading());
    assert.equal(result.valid, true);
    assert.equal(result.value.scenario, null);
    assert.equal(result.value.source, 'sensor');
  });

  it('rejects temperatureC below -40', () => {
    const result = validateReading(validSimulatedReading({ temperatureC: -41 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('temperatureC')));
  });

  it('rejects temperatureC above 150', () => {
    const result = validateReading(validSimulatedReading({ temperatureC: 151 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('temperatureC')));
  });

  it('rejects negative vibrationRmsG', () => {
    const result = validateReading(validSimulatedReading({ vibrationRmsG: -0.1 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('vibrationRmsG')));
  });

  it('rejects NaN currentA', () => {
    const result = validateReading(validSimulatedReading({ currentA: NaN }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('currentA')));
  });

  it('rejects non-ISO timestamp', () => {
    const result = validateReading(validSimulatedReading({ timestamp: 'not-a-date' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('timestamp')));
  });

  it('rejects timestamp without offset', () => {
    const result = validateReading(
      validSimulatedReading({ timestamp: '2026-06-15T10:30:00.000' })
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('offset')));
  });

  it('rejects unknown source', () => {
    const result = validateReading(validSimulatedReading({ source: 'file' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('source')));
  });

  it('rejects simulated reading without scenario', () => {
    const r = validSimulatedReading();
    delete r.scenario;
    const result = validateReading(r);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('scenario')));
  });

  it('rejects sensor reading with scenario set', () => {
    const result = validateReading(validSensorReading({ scenario: 'normal' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('scenario')));
  });

  it('rejects unknown top-level keys', () => {
    const result = validateReading(validSimulatedReading({ extraField: 42 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('unknown key') && e.includes('extraField')));
  });

  it('rejects invalid dataQuality', () => {
    const result = validateReading(
      validSimulatedReading({ dataQuality: { windowSamples: 0, dropoutCount: -1 } })
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('windowSamples')));
    assert.ok(result.errors.some((e) => e.includes('dropoutCount')));
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const result = validateReading(
      validSimulatedReading({ temperatureC: 200, vibrationRmsG: -1, currentA: NaN })
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 3);
  });

  it('does not throw on null input', () => {
    const result = validateReading(null);
    assert.equal(result.valid, false);
  });

  it('does not throw on undefined input', () => {
    const result = validateReading(undefined);
    assert.equal(result.valid, false);
  });

  it('does not throw on string input', () => {
    const result = validateReading('hello');
    assert.equal(result.valid, false);
  });

  it('does not throw on array input', () => {
    const result = validateReading([1, 2, 3]);
    assert.equal(result.valid, false);
  });

  it('accepts reading with dataQuality absent and omits it from normalized value', () => {
    const r = validSimulatedReading();
    delete r.dataQuality;
    const result = validateReading(r);
    assert.equal(result.valid, true);
    assert.equal(result.value.dataQuality, undefined);
  });

  it('exports SOURCE_TYPES as a frozen array', () => {
    assert.ok(Object.isFrozen(SOURCE_TYPES));
    assert.deepStrictEqual(SOURCE_TYPES, ['simulated', 'sensor']);
  });

  it('exports SCENARIOS as a frozen array', () => {
    assert.ok(Object.isFrozen(SCENARIOS));
    assert.equal(SCENARIOS.length, 5);
  });
});
