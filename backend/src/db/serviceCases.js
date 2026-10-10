function mapServiceCase(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    machineId: row.machine_id,
    status: row.status,
    detectedSymptom: row.detected_symptom,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

export async function createServiceCase(pool, { machineId, detectedSymptom = null }) {
  const query = `
    insert into service_cases (machine_id, status, detected_symptom)
    values ($1, 'open', $2)
    returning id, machine_id, status, detected_symptom, created_at, closed_at;
  `;
  const result = await pool.query(query, [machineId, detectedSymptom]);
  return mapServiceCase(result.rows[0]);
}

export async function getServiceCase(pool, id) {
  const query = `
    select id, machine_id, status, detected_symptom, created_at, closed_at
    from service_cases
    where id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? mapServiceCase(result.rows[0]) : null;
}

export async function listServiceCasesForMachine(pool, machineId) {
  const query = `
    select id, machine_id, status, detected_symptom, created_at, closed_at
    from service_cases
    where machine_id = $1
    order by created_at, id;
  `;
  const result = await pool.query(query, [machineId]);
  return result.rows.map(mapServiceCase);
}
