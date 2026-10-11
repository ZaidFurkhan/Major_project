// Telemetry reading units (fixed by field name):
//   temperatureC  – degrees Celsius
//   vibrationRmsG – RMS acceleration in g (derived over a measurement window)
//   currentA      – amperes
//   rpm           – revolutions per minute
//   commandedRpm  – revolutions per minute (or null when unavailable)

export const SOURCE_TYPES = Object.freeze(['simulated', 'sensor']);

export const SCENARIOS = Object.freeze([
  'normal',
  'vibration_anomaly',
  'overheating',
  'abnormal_load',
  'rpm_anomaly',
]);

const KNOWN_KEYS = new Set([
  'machineId',
  'timestamp',
  'source',
  'scenario',
  'temperatureC',
  'vibrationRmsG',
  'currentA',
  'rpm',
  'commandedRpm',
  'dataQuality',
]);

// ISO 8601 with trailing Z or explicit offset (±HH:MM or ±HHMM or ±HH)
const ISO_WITH_OFFSET_RE =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Validate a telemetry reading. Returns { valid, value?, errors? }.
 * Never throws, even on null / undefined / non-object input.
 */
export function validateReading(reading) {
  const errors = [];

  if (reading == null || typeof reading !== 'object' || Array.isArray(reading)) {
    return { valid: false, errors: ['reading must be a non-null object'] };
  }

  // Unknown keys
  for (const key of Object.keys(reading)) {
    if (!KNOWN_KEYS.has(key)) {
      errors.push(`unknown key: ${key}`);
    }
  }

  // machineId
  if (typeof reading.machineId !== 'string' || reading.machineId.length === 0) {
    errors.push('machineId must be a non-empty string');
  }

  // timestamp – must be ISO 8601 with explicit offset or Z
  let normalizedTimestamp = undefined;
  if (typeof reading.timestamp !== 'string') {
    errors.push('timestamp must be an ISO 8601 string');
  } else if (!ISO_WITH_OFFSET_RE.test(reading.timestamp)) {
    errors.push('timestamp must include a trailing Z or explicit offset');
  } else {
    const d = new Date(reading.timestamp);
    if (Number.isNaN(d.getTime())) {
      errors.push('timestamp is not a valid date');
    } else {
      normalizedTimestamp = d.toISOString();
    }
  }

  // source
  if (!SOURCE_TYPES.includes(reading.source)) {
    errors.push(`source must be one of: ${SOURCE_TYPES.join(', ')}`);
  }

  // scenario
  const isSimulated = reading.source === 'simulated';
  const isSensor = reading.source === 'sensor';

  if (isSimulated) {
    if (!SCENARIOS.includes(reading.scenario)) {
      errors.push(`scenario must be one of: ${SCENARIOS.join(', ')} when source is simulated`);
    }
  } else if (isSensor) {
    if (reading.scenario !== undefined && reading.scenario !== null) {
      errors.push('scenario must be absent or null when source is sensor');
    }
  }

  // temperatureC
  if (typeof reading.temperatureC !== 'number' || !Number.isFinite(reading.temperatureC)) {
    errors.push('temperatureC must be a finite number');
  } else if (reading.temperatureC < -40 || reading.temperatureC > 150) {
    errors.push('temperatureC must be between -40 and 150 inclusive');
  }

  // vibrationRmsG
  if (typeof reading.vibrationRmsG !== 'number' || !Number.isFinite(reading.vibrationRmsG)) {
    errors.push('vibrationRmsG must be a finite number');
  } else if (reading.vibrationRmsG < 0) {
    errors.push('vibrationRmsG must be >= 0');
  }

  // currentA
  if (typeof reading.currentA !== 'number' || !Number.isFinite(reading.currentA)) {
    errors.push('currentA must be a finite number');
  } else if (reading.currentA < 0) {
    errors.push('currentA must be >= 0');
  }

  // rpm
  if (typeof reading.rpm !== 'number' || !Number.isFinite(reading.rpm)) {
    errors.push('rpm must be a finite number');
  } else if (reading.rpm < 0) {
    errors.push('rpm must be >= 0');
  }

  // commandedRpm – may be null
  if (reading.commandedRpm !== null && reading.commandedRpm !== undefined) {
    if (typeof reading.commandedRpm !== 'number' || !Number.isFinite(reading.commandedRpm)) {
      errors.push('commandedRpm must be a finite number >= 0, or null');
    } else if (reading.commandedRpm < 0) {
      errors.push('commandedRpm must be >= 0');
    }
  }

  // dataQuality (optional)
  if (reading.dataQuality !== undefined && reading.dataQuality !== null) {
    if (typeof reading.dataQuality !== 'object' || Array.isArray(reading.dataQuality)) {
      errors.push('dataQuality must be an object with windowSamples and dropoutCount');
    } else {
      const { windowSamples, dropoutCount } = reading.dataQuality;
      if (!Number.isInteger(windowSamples) || windowSamples < 1) {
        errors.push('dataQuality.windowSamples must be an integer >= 1');
      }
      if (!Number.isInteger(dropoutCount) || dropoutCount < 0) {
        errors.push('dataQuality.dropoutCount must be an integer >= 0');
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build normalized value
  const value = {
    machineId: reading.machineId,
    timestamp: normalizedTimestamp,
    source: reading.source,
  };

  if (isSimulated) {
    value.scenario = reading.scenario;
  } else {
    value.scenario = null;
  }

  value.temperatureC = reading.temperatureC;
  value.vibrationRmsG = reading.vibrationRmsG;
  value.currentA = reading.currentA;
  value.rpm = reading.rpm;
  value.commandedRpm = reading.commandedRpm !== undefined ? reading.commandedRpm : null;

  if (reading.dataQuality !== undefined && reading.dataQuality !== null) {
    value.dataQuality = {
      windowSamples: reading.dataQuality.windowSamples,
      dropoutCount: reading.dataQuality.dropoutCount,
    };
  }

  return { valid: true, value };
}
