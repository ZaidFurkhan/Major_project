import { SCENARIOS, validateReading } from '../telemetry/contract.js';
import { PLACEHOLDER_THRESHOLDS as T } from '../telemetry/thresholds.js';

const DEFAULT_START_TIME = '2026-01-01T00:00:00.000Z';
const TIME_STEP_MS = 1000;

// Seeded PRNG – mulberry32. Returns a function that yields [0, 1).
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small bounded noise centered on 0, range roughly [-amplitude, +amplitude]
function noise(rng, amplitude) {
  return (rng() - 0.5) * 2 * amplitude;
}

/**
 * Create a deterministic simulator that yields one telemetry reading per next() call.
 */
export function createSimulator({ machineId, scenario, seed, startTime } = {}) {
  if (typeof machineId !== 'string' || machineId.length === 0) {
    throw new Error('machineId must be a non-empty string');
  }
  if (!SCENARIOS.includes(scenario)) {
    throw new Error(`scenario must be one of: ${SCENARIOS.join(', ')}`);
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('seed must be a finite number');
  }

  const resolvedStartTime = startTime !== undefined ? startTime : DEFAULT_START_TIME;
  const startMs = new Date(resolvedStartTime).getTime();
  if (Number.isNaN(startMs)) {
    throw new Error('startTime must be a valid ISO 8601 date string');
  }

  const rng = mulberry32(seed);
  let step = 0;

  return {
    next() {
      const timestamp = new Date(startMs + step * TIME_STEP_MS).toISOString();
      const reading = buildReading(rng, machineId, scenario, timestamp, step);
      step++;

      const result = validateReading(reading);
      if (!result.valid) {
        throw new Error(
          `Simulator produced invalid reading at step ${step - 1}: ${result.errors.join('; ')}`
        );
      }

      return result.value;
    },
  };
}

function buildReading(rng, machineId, scenario, timestamp, step) {
  const base = {
    machineId,
    timestamp,
    source: 'simulated',
    scenario,
    temperatureC: T.baselineTemperatureC + noise(rng, 2),
    vibrationRmsG: T.baselineVibrationRmsG + noise(rng, 0.05),
    currentA: T.baselineCurrentA + noise(rng, 0.3),
    rpm: T.commandedRpm + noise(rng, 10),
    commandedRpm: T.commandedRpm,
    dataQuality: {
      windowSamples: 100,
      dropoutCount: Math.floor(rng() * 3),
    },
  };

  // Ramp starts after step 9 (baseline) and reaches full anomaly magnitude by step 40
  const ramp = Math.max(0, Math.min(1, (step - 10) / 30));

  switch (scenario) {
    case 'normal':
      // All channels near baseline – already set above
      break;

    case 'vibration_anomaly': {
      // Vibration gradually rises; other channels stay near baseline
      base.vibrationRmsG =
        T.baselineVibrationRmsG + ramp * (T.anomalyVibrationRmsG - T.baselineVibrationRmsG) + noise(rng, 0.05);
      break;
    }

    case 'overheating': {
      // Temperature rises gradually to overheat cap; noise drawn to preserve RNG sequence
      noise(rng, 0.1);
      base.temperatureC =
        T.baselineTemperatureC + ramp * (T.overheatTemperatureC - T.baselineTemperatureC);
      break;
    }

    case 'abnormal_load': {
      // Current gradually rises, rpm gradually falls; temperature slightly elevated
      base.currentA = T.baselineCurrentA + ramp * (T.abnormalLoadCurrentA - T.baselineCurrentA) + noise(rng, 0.2);
      base.rpm = T.commandedRpm - ramp * (T.commandedRpm - T.abnormalLoadRpm) + noise(rng, 10);
      base.temperatureC = T.baselineTemperatureC + ramp * 3 + noise(rng, 1);
      break;
    }

    case 'rpm_anomaly': {
      // RPM gradually deviates from commandedRpm
      base.rpm = T.commandedRpm + ramp * T.rpmAnomalyOffset + noise(rng, 15);
      break;
    }
  }

  // Clamp values to contract ranges to guarantee validity
  base.temperatureC = clamp(base.temperatureC, -40, 150);
  base.vibrationRmsG = Math.max(0, base.vibrationRmsG);
  base.currentA = Math.max(0, base.currentA);
  base.rpm = Math.max(0, base.rpm);

  return base;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
