export function buildCaseReport({
  machine,
  serviceCase,
  verificationResults,
  diagnoses,
} = {}) {
  if (!machine || !serviceCase) {
    return { status: 'not_found' };
  }

  const formattedDiagnoses = (diagnoses || []).map((d) => ({
    createdAt: d.createdAt,
    status: d.status,
    signatures: d.signatures,
    candidates: d.candidates,
    dataSources: d.dataSources,
    uncertainty: d.uncertainty,
  }));

  const latestDiagnosis =
    formattedDiagnoses.length > 0
      ? formattedDiagnoses[formattedDiagnoses.length - 1]
      : null;

  const verifications = (verificationResults || []).map((v) => ({
    createdAt: v.createdAt,
    status: v.status,
    targetSignature: v.targetSignature,
    reason: v.reason,
    detectedSignatures: v.detectedSignatures,
    uncertainty: v.uncertainty,
  }));

  const latestVerification =
    verifications.length > 0 ? verifications[verifications.length - 1] : null;

  let repairOutcome;
  if (!latestVerification) {
    repairOutcome = 'no_verification_recorded';
  } else if (latestVerification.status === 'PASS') {
    repairOutcome = 'verified';
  } else {
    repairOutcome = 'not_verified';
  }

  const notes = [
    'Diagnoses are stored as possible causes with checks to run, not as confirmed causes.',
    'Verification compares post-repair readings with the supplied baseline only and does not prove the cause was repaired.',
    'Simulated readings must not be used for a real machine decision.',
  ];

  if (serviceCase.status === 'closed' && repairOutcome !== 'verified') {
    notes.push('Case is closed without a PASS verification; review before relying on it.');
  }

  return {
    status: 'ok',
    case: {
      id: serviceCase.id,
      status: serviceCase.status,
      detectedSymptom: serviceCase.detectedSymptom,
      createdAt: serviceCase.createdAt,
      closedAt: serviceCase.closedAt,
    },
    machine: {
      id: machine.id,
      name: machine.name,
      type: machine.type,
      location: machine.location,
    },
    diagnoses: formattedDiagnoses,
    latestDiagnosis,
    verifications,
    latestVerification,
    repairOutcome,
    notes,
  };
}

export function renderCaseReportText(report) {
  if (!report || report.status !== 'ok') {
    return 'Case not found.';
  }

  const lines = [
    `Case ID: ${report.case.id}`,
    `Machine: ${report.machine.name} (${report.machine.type})`,
    `Case Status: ${report.case.status}`,
    `Repair Outcome: ${report.repairOutcome}`,
    '',
    'Verifications:',
  ];

  if (report.verifications.length === 0) {
    lines.push('  No verifications recorded.');
  } else {
    for (const v of report.verifications) {
      const dateStr = v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt);
      lines.push(`  - [${v.status}] ${v.targetSignature}: ${v.reason} (${dateStr})`);
    }
  }

  lines.push('', 'Notes:');
  for (const note of report.notes) {
    lines.push(`  - ${note}`);
  }

  return lines.join('\n');
}
