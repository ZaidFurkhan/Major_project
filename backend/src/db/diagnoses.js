const ALLOWED_SIGNATURES = Object.freeze([
  'vibration_elevated',
  'overheating',
  'abnormal_load',
  'rpm_deviation',
]);

function mapDiagnosis(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    serviceCaseId: row.service_case_id,
    status: row.status,
    signatures: row.signatures,
    candidates:
      typeof row.candidates === 'string' ? JSON.parse(row.candidates) : row.candidates,
    dataSources: row.data_sources,
    uncertainty: row.uncertainty,
    createdAt: row.created_at,
  };
}

export async function insertDiagnosis(pool, { serviceCaseId, diagnosis }) {
  if (!diagnosis || (diagnosis.status !== 'diagnosed' && diagnosis.status !== 'inconclusive')) {
    throw new Error(
      `Invalid diagnosis status: ${diagnosis?.status}. Only 'diagnosed' or 'inconclusive' may be stored.`
    );
  }

  const rawSignatures = diagnosis.signatures ?? [];
  if (!Array.isArray(rawSignatures)) {
    throw new Error('diagnosis.signatures must be an array');
  }

  const signatureTypes = rawSignatures.map((sig) => {
    if (typeof sig === 'string') {
      return sig;
    }
    if (sig && typeof sig.type === 'string') {
      return sig.type;
    }
    throw new Error(`Invalid signature item: ${JSON.stringify(sig)}`);
  });

  for (const sigType of signatureTypes) {
    if (!ALLOWED_SIGNATURES.includes(sigType)) {
      throw new Error(`Invalid signature type: ${sigType}`);
    }
  }

  const candidates = diagnosis.candidates ?? [];
  const candidatesJson =
    typeof candidates === 'string' ? candidates : JSON.stringify(candidates);
  const dataSources = diagnosis.dataSources ?? [];
  const uncertainty = diagnosis.uncertainty ?? '';

  const query = `
    insert into diagnoses (
      service_case_id,
      status,
      signatures,
      candidates,
      data_sources,
      uncertainty
    )
    values ($1, $2, $3, $4, $5, $6)
    returning id, service_case_id, status, signatures, candidates, data_sources, uncertainty, created_at;
  `;

  const result = await pool.query(query, [
    serviceCaseId,
    diagnosis.status,
    signatureTypes,
    candidatesJson,
    dataSources,
    uncertainty,
  ]);

  return mapDiagnosis(result.rows[0]);
}

export async function listDiagnosesForCase(pool, serviceCaseId) {
  const query = `
    select id, service_case_id, status, signatures, candidates, data_sources, uncertainty, created_at
    from diagnoses
    where service_case_id = $1
    order by created_at, id;
  `;
  const result = await pool.query(query, [serviceCaseId]);
  return result.rows.map(mapDiagnosis);
}
