import { validateReading } from '../telemetry/contract.js';

// Placeholder relative rise in vibration RMS required to flag vibration_elevated
// Placeholder assumption, not a calibrated or documented motor limit
const PLACEHOLDER_RELATIVE_VIBRATION_RISE = 0.30;

// Placeholder temperature rise in degrees Celsius required to flag overheating
// Placeholder assumption, not a calibrated or documented motor limit
const PLACEHOLDER_TEMPERATURE_RISE_C = 5.0;

// Placeholder relative rise in motor current required to flag abnormal_load
// Placeholder assumption, not a calibrated or documented motor limit
const PLACEHOLDER_RELATIVE_CURRENT_RISE = 0.08;

// Placeholder fraction of commanded RPM for mean absolute deviation to flag rpm_deviation
// Placeholder assumption, not a calibrated or documented motor limit
const PLACEHOLDER_RPM_DEVIATION_FRACTION = 0.02;

function mean(readings, key) {
  let sum = 0;
  for (let i = 0; i < readings.length; i++) {
    sum += readings[i][key];
  }
  return sum / readings.length;
}

function computeChannelMeans(readings) {
  return {
    temperatureC: mean(readings, 'temperatureC'),
    vibrationRmsG: mean(readings, 'vibrationRmsG'),
    currentA: mean(readings, 'currentA'),
    rpm: mean(readings, 'rpm'),
  };
}

/**
 * Deterministic anomaly detector for a window of telemetry readings.
 * Pure function: no I/O, no randomness, no mutation of input. Never throws.
 *
 * @param {Array} readings - Array of validated telemetry readings in time order.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.baselineCount=10] - Number of earliest readings used as baseline.
 * @param {number} [options.windowCount=10] - Number of most recent readings used as window.
 * @returns {Object} Detection result.
 */
export function detectAnomalies(readings, options = {}) {
  try {
    if (!Array.isArray(readings)) {
      return {
        status: 'invalid_input',
        errors: ['readings must be an array'],
        signatures: [],
      };
    }

    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      return {
        status: 'invalid_input',
        errors: ['options must be a plain object'],
        signatures: [],
      };
    }

    const baselineCount = options.baselineCount !== undefined ? options.baselineCount : 10;
    const windowCount = options.windowCount !== undefined ? options.windowCount : 10;

    const optionErrors = [];
    if (!Number.isInteger(baselineCount) || baselineCount < 1) {
      optionErrors.push('baselineCount must be an integer >= 1');
    }
    if (!Number.isInteger(windowCount) || windowCount < 1) {
      optionErrors.push('windowCount must be an integer >= 1');
    }

    if (optionErrors.length > 0) {
      return {
        status: 'invalid_input',
        errors: optionErrors,
        signatures: [],
      };
    }

    // Validate every reading without modifying the input array
    const readingErrors = [];
    const normalizedReadings = [];
    for (let i = 0; i < readings.length; i++) {
      const validation = validateReading(readings[i]);
      if (!validation.valid) {
        readingErrors.push(`reading at index ${i} is invalid: ${validation.errors.join('; ')}`);
      } else {
        normalizedReadings.push(validation.value);
      }
    }

    if (readingErrors.length > 0) {
      return {
        status: 'invalid_input',
        errors: readingErrors,
        signatures: [],
      };
    }

    const required = baselineCount + windowCount;
    if (normalizedReadings.length < required) {
      return {
        status: 'insufficient_data',
        required,
        received: normalizedReadings.length,
        signatures: [],
      };
    }

    const baselineReadings = normalizedReadings.slice(0, baselineCount);
    const windowReadings = normalizedReadings.slice(-windowCount);

    const baselineMeans = computeChannelMeans(baselineReadings);
    const windowMeans = computeChannelMeans(windowReadings);

    const signatures = [];

    // 1. vibration_elevated
    const vibrationThreshold = baselineMeans.vibrationRmsG * (1 + PLACEHOLDER_RELATIVE_VIBRATION_RISE);
    if (windowMeans.vibrationRmsG >= vibrationThreshold) {
      signatures.push({
        type: 'vibration_elevated',
        evidence: {
          baselineMean: baselineMeans.vibrationRmsG,
          windowMean: windowMeans.vibrationRmsG,
          ratio: windowMeans.vibrationRmsG / baselineMeans.vibrationRmsG,
        },
      });
    }

    // 2. overheating
    const tempRise = windowMeans.temperatureC - baselineMeans.temperatureC;
    const firstWindowTemp = windowReadings[0].temperatureC;
    const lastWindowTemp = windowReadings[windowReadings.length - 1].temperatureC;
    const isNonDecreasingOverall = lastWindowTemp >= firstWindowTemp;

    if (tempRise >= PLACEHOLDER_TEMPERATURE_RISE_C && isNonDecreasingOverall) {
      signatures.push({
        type: 'overheating',
        evidence: {
          baselineMean: baselineMeans.temperatureC,
          windowMean: windowMeans.temperatureC,
          riseInC: tempRise,
        },
      });
    }

    // 3. abnormal_load
    const currentThreshold = baselineMeans.currentA * (1 + PLACEHOLDER_RELATIVE_CURRENT_RISE);
    if (windowMeans.currentA >= currentThreshold && windowMeans.rpm < baselineMeans.rpm) {
      signatures.push({
        type: 'abnormal_load',
        evidence: {
          baselineCurrentMean: baselineMeans.currentA,
          windowCurrentMean: windowMeans.currentA,
          currentRatio: windowMeans.currentA / baselineMeans.currentA,
          baselineRpmMean: baselineMeans.rpm,
          windowRpmMean: windowMeans.rpm,
          rpmDrop: baselineMeans.rpm - windowMeans.rpm,
        },
      });
    }

    // 4. rpm_deviation
    const readingsWithCmd = windowReadings.filter(
      (r) => r.commandedRpm !== null && r.commandedRpm !== undefined
    );
    const excludedCount = windowReadings.length - readingsWithCmd.length;

    if (readingsWithCmd.length > 0) {
      let cmdSum = 0;
      let absDiffSum = 0;
      for (let i = 0; i < readingsWithCmd.length; i++) {
        cmdSum += readingsWithCmd[i].commandedRpm;
        absDiffSum += Math.abs(readingsWithCmd[i].rpm - readingsWithCmd[i].commandedRpm);
      }
      const windowMeanCommandedRpm = cmdSum / readingsWithCmd.length;
      const meanAbsoluteDifference = absDiffSum / readingsWithCmd.length;

      if (
        windowMeanCommandedRpm > 0 &&
        meanAbsoluteDifference >= PLACEHOLDER_RPM_DEVIATION_FRACTION * windowMeanCommandedRpm
      ) {
        signatures.push({
          type: 'rpm_deviation',
          evidence: {
            windowMeanCommandedRpm,
            meanAbsoluteDifference,
            fractionOfCommanded: meanAbsoluteDifference / windowMeanCommandedRpm,
            excludedCount,
          },
        });
      }
    }

    return {
      status: signatures.length > 0 ? 'anomalous' : 'normal',
      signatures,
      baseline: baselineMeans,
      window: windowMeans,
    };
  } catch (err) {
    return {
      status: 'invalid_input',
      errors: [err.message || 'unexpected error'],
      signatures: [],
    };
  }
}
