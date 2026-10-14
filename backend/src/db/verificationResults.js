const ALLOWED_SIGNATURES = Object.freeze([
  'vibration_elevated',
  'overheating',
  'abnormal_load',
  'rpm_deviation',
]);

function mapVerificationResult(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    serviceCaseId: row.service_case_id,
    targetSignature: row.target_signature,
    status: row.status,
    reason: row.reason,
    detectedSignatures: row.detected_signatures,
    evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence,
    uncertainty: row.uncertainty,
    createdAt: row.created_at,
  };
}

export async function insertVerificationResult(
  pool,
  { serviceCaseId, targetSignature, status, reason, detectedSignatures, evidence, uncertainty }
) {
  const signatures = detectedSignatures ?? [];
  if (!Array.isArray(signatures)) {
    throw new Error('detectedSignatures must be an array');
  }
  for (const sig of signatures) {
    if (!ALLOWED_SIGNATURES.includes(sig)) {
      throw new Error(`detectedSignatures contains invalid signature: ${sig}`);
    }
  }

  const query = `
    insert into verification_results (
      service_case_id,
      target_signature,
      status,
      reason,
      detected_signatures,
      evidence,
      uncertainty
    )
    values ($1, $2, $3, $4, $5, $6, $7)
    returning id, service_case_id, target_signature, status, reason, detected_signatures, evidence, uncertainty, created_at;
  `;

  const evidenceJson = typeof evidence === 'string' ? evidence : JSON.stringify(evidence);

  const result = await pool.query(query, [
    serviceCaseId,
    targetSignature,
    status,
    reason,
    signatures,
    evidenceJson,
    uncertainty,
  ]);

  return mapVerificationResult(result.rows[0]);
}

export async function listVerificationResultsForCase(pool, serviceCaseId) {
  const query = `
    select id, service_case_id, target_signature, status, reason, detected_signatures, evidence, uncertainty, created_at
    from verification_results
    where service_case_id = $1
    order by created_at, id;
  `;
  const result = await pool.query(query, [serviceCaseId]);
  return result.rows.map(mapVerificationResult);
}
