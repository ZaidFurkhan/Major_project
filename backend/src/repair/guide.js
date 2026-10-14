import { getApprovedProcedureForSignature } from '../db/repairProcedures.js';

export const ALLOWED_FAULT_SIGNATURES = Object.freeze([
  'vibration_elevated',
  'overheating',
  'abnormal_load',
  'rpm_deviation',
]);

export async function getRepairGuide(pool, faultSignature) {
  if (!ALLOWED_FAULT_SIGNATURES.includes(faultSignature)) {
    return {
      status: 'invalid_signature',
      allowed: ALLOWED_FAULT_SIGNATURES,
    };
  }

  const result = await getApprovedProcedureForSignature(pool, faultSignature);
  if (!result) {
    return {
      status: 'no_approved_procedure',
      faultSignature,
      steps: [],
    };
  }

  const { procedure, steps } = result;

  return {
    status: 'found',
    faultSignature,
    procedure: {
      id: procedure.id,
      title: procedure.title,
      sourceReference: procedure.sourceReference,
      approvedAt: procedure.approvedAt,
    },
    steps: steps.map((s) => ({
      stepOrder: s.stepOrder,
      instruction: s.instruction,
      sourceLocation: s.sourceLocation,
    })),
  };
}
