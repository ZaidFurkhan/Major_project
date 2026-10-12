import { detectAnomalies } from '../analysis/anomalyDetector.js';
import { CANDIDATE_RULES } from './candidateRules.js';

const UNCERTAINTY =
  'Candidate causes are possible causes that require the checkNext measurements to confirm. When dataSources includes simulated data, the result is for demonstration only and must not be used for a real machine decision.';

const RULE_ORDER = Object.values(CANDIDATE_RULES).flatMap((rules) =>
  rules.map((rule) => rule.id)
);

function extractDataSources(readings) {
  if (!Array.isArray(readings)) {
    return [];
  }
  const sources = new Set();
  for (const reading of readings) {
    if (reading && typeof reading.source === 'string') {
      sources.add(reading.source);
    }
  }
  return Array.from(sources).sort();
}

/**
 * Deterministic candidate-cause diagnosis module.
 * Evaluates telemetry readings using anomaly detection and maps detected
 * signatures to candidate causes with supporting/contradicting evidence.
 * Pure function: no I/O, no Date.now(), no randomness, no mutation of input.
 *
 * @param {Array} readings - Array of validated telemetry readings in time order.
 * @param {Object} [options] - Configuration options passed to detectAnomalies.
 * @returns {Object} Structured diagnosis result.
 */
export function diagnose(readings, options = {}) {
  const detectorResult = detectAnomalies(readings, options);

  if (detectorResult.status === 'invalid_input') {
    return {
      ...detectorResult,
      candidates: [],
      dataSources: [],
    };
  }

  if (detectorResult.status === 'insufficient_data') {
    return {
      ...detectorResult,
      candidates: [],
      dataSources: extractDataSources(readings),
    };
  }

  const dataSources = extractDataSources(readings);

  if (detectorResult.status === 'normal') {
    return {
      status: 'inconclusive',
      reason: 'no fault signature was detected',
      candidates: [],
      evidence: detectorResult,
      dataSources,
      uncertainty: UNCERTAINTY,
    };
  }

  if (detectorResult.status === 'anomalous') {
    const detectedSignatures = detectorResult.signatures || [];
    const detectedSignatureTypes = new Set(detectedSignatures.map((s) => s.type));

    const candidateMap = new Map();

    for (const signature of detectedSignatures) {
      const rules = CANDIDATE_RULES[signature.type] || [];
      for (const rule of rules) {
        if (!candidateMap.has(rule.id)) {
          const supporting = detectedSignatures.filter((s) =>
            rule.supportedBy.includes(s.type)
          );
          const supportingSignatures = supporting.map((s) => s.type);
          const supportingEvidence = supporting.map((s) => ({ ...s.evidence }));

          const contradictions = [];
          for (const item of rule.contradictedBy || []) {
            if (!detectedSignatureTypes.has(item.signature)) {
              contradictions.push({
                signature: item.signature,
                reason: item.reason,
              });
            }
          }

          const candidateOutput = {
            id: rule.id,
            label: rule.label,
            supportingSignatures,
            supportingEvidence,
            contradictions,
            checkNext: rule.checkNext,
          };

          if (contradictions.length > 0) {
            candidateOutput.contradicted = true;
          }

          candidateMap.set(rule.id, candidateOutput);
        }
      }
    }

    const candidateList = Array.from(candidateMap.values());

    candidateList.sort((a, b) => {
      const countDiff = b.supportingSignatures.length - a.supportingSignatures.length;
      if (countDiff !== 0) {
        return countDiff;
      }
      return RULE_ORDER.indexOf(a.id) - RULE_ORDER.indexOf(b.id);
    });

    return {
      status: 'diagnosed',
      signatures: detectedSignatures,
      candidates: candidateList,
      dataSources,
      uncertainty: UNCERTAINTY,
    };
  }

  return {
    status: 'invalid_input',
    errors: ['unexpected detector status'],
    signatures: [],
    candidates: [],
    dataSources: [],
  };
}
