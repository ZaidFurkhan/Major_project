import { detectAnomalies } from '../analysis/anomalyDetector.js';
import { validateReading } from '../telemetry/contract.js';

// Placeholder minimum window sizes. Replace with values from calibration or a documented test procedure.
export const MIN_BASELINE_READINGS = 10;
export const MIN_POST_REPAIR_READINGS = 10;

const ALLOWED_TARGET_SIGNATURES = Object.freeze([
  'vibration_elevated',
  'overheating',
  'abnormal_load',
  'rpm_deviation',
]);

const UNCERTAINTY_STATEMENT =
  'This decision compares post-repair readings with the supplied baseline only. It does not prove the cause was repaired, and simulated readings must not be used for a real machine decision.';

export function verifyRepair({ baselineReadings, postRepairReadings, targetSignature } = {}) {
  const errors = [];

  if (!Array.isArray(baselineReadings)) {
    errors.push('baselineReadings must be an array');
  }

  if (!Array.isArray(postRepairReadings)) {
    errors.push('postRepairReadings must be an array');
  }

  if (!ALLOWED_TARGET_SIGNATURES.includes(targetSignature)) {
    errors.push(`targetSignature must be one of: ${ALLOWED_TARGET_SIGNATURES.join(', ')}`);
  }

  if (Array.isArray(baselineReadings)) {
    for (let i = 0; i < baselineReadings.length; i++) {
      const validation = validateReading(baselineReadings[i]);
      if (!validation.valid) {
        errors.push(`baselineReadings at index ${i} is invalid: ${validation.errors.join('; ')}`);
      }
    }
  }

  if (Array.isArray(postRepairReadings)) {
    for (let i = 0; i < postRepairReadings.length; i++) {
      const validation = validateReading(postRepairReadings[i]);
      if (!validation.valid) {
        errors.push(`postRepairReadings at index ${i} is invalid: ${validation.errors.join('; ')}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: 'invalid_input',
      errors,
    };
  }

  if (
    baselineReadings.length < MIN_BASELINE_READINGS ||
    postRepairReadings.length < MIN_POST_REPAIR_READINGS
  ) {
    return {
      status: 'INCONCLUSIVE',
      reason: 'insufficient readings',
      required: {
        baseline: MIN_BASELINE_READINGS,
        postRepair: MIN_POST_REPAIR_READINGS,
      },
      received: {
        baseline: baselineReadings.length,
        postRepair: postRepairReadings.length,
      },
      signatures: [],
    };
  }

  const combined = [...baselineReadings, ...postRepairReadings];
  const detector = detectAnomalies(combined, {
    baselineCount: baselineReadings.length,
    windowCount: postRepairReadings.length,
  });

  if (detector.status !== 'normal' && detector.status !== 'anomalous') {
    return {
      status: 'INCONCLUSIVE',
      reason: 'anomaly detector returned non-standard status',
      targetSignature,
      detectedSignatures: (detector.signatures || []).map((s) => s.type),
      evidence: detector,
      uncertainty: UNCERTAINTY_STATEMENT,
    };
  }

  const detected = detector.signatures.map((s) => s.type);

  let status;
  let reason;

  if (detected.includes(targetSignature)) {
    status = 'FAIL';
    reason = 'target fault still present after repair';
  } else if (detected.length === 0) {
    status = 'PASS';
    reason = 'no fault signature in post-repair window relative to baseline';
  } else {
    status = 'INCONCLUSIVE';
    reason = 'a different fault signature appeared after repair; inspection required';
  }

  return {
    status,
    reason,
    targetSignature,
    detectedSignatures: detected,
    evidence: {
      baseline: detector.baseline,
      window: detector.window,
      signatures: detector.signatures,
    },
    uncertainty: UNCERTAINTY_STATEMENT,
  };
}
