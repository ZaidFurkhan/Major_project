import { getServiceCase } from './serviceCases.js';
import { getMachine } from './machines.js';
import { listVerificationResultsForCase } from './verificationResults.js';
import { listDiagnosesForCase } from './diagnoses.js';

export async function loadCaseReport(pool, caseId) {
  const serviceCase = await getServiceCase(pool, caseId);
  if (!serviceCase) {
    return {
      machine: null,
      serviceCase: null,
      verificationResults: [],
      diagnoses: [],
    };
  }

  const machine = await getMachine(pool, serviceCase.machineId);
  const verificationResults = await listVerificationResultsForCase(pool, caseId);
  const diagnoses = await listDiagnosesForCase(pool, caseId);

  return {
    machine: machine ?? null,
    serviceCase,
    verificationResults,
    diagnoses,
  };
}
