function mapRepairProcedure(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    faultSignature: row.fault_signature,
    title: row.title,
    sourceReference: row.source_reference,
    status: row.status,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

function mapRepairStep(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    procedureId: row.procedure_id,
    stepOrder: row.step_order,
    instruction: row.instruction,
    sourceLocation: row.source_location,
  };
}

export async function createRepairProcedure(pool, { faultSignature, title, sourceReference }) {
  const query = `
    insert into repair_procedures (fault_signature, title, source_reference, status)
    values ($1, $2, $3, 'draft')
    returning id, fault_signature, title, source_reference, status, approved_at, created_at;
  `;
  const result = await pool.query(query, [faultSignature, title, sourceReference]);
  return mapRepairProcedure(result.rows[0]);
}

export async function addRepairStep(pool, { procedureId, stepOrder, instruction, sourceLocation }) {
  const query = `
    insert into repair_steps (procedure_id, step_order, instruction, source_location)
    values ($1, $2, $3, $4)
    returning id, procedure_id, step_order, instruction, source_location;
  `;
  const result = await pool.query(query, [procedureId, stepOrder, instruction, sourceLocation]);
  return mapRepairStep(result.rows[0]);
}

export async function approveRepairProcedure(pool, procedureId) {
  const query = `
    update repair_procedures
    set status = 'approved', approved_at = now()
    where id = $1
      and status = 'draft'
      and (select count(*) from repair_steps where procedure_id = $1) > 0
    returning id, fault_signature, title, source_reference, status, approved_at, created_at;
  `;
  const result = await pool.query(query, [procedureId]);
  return result.rows.length > 0 ? mapRepairProcedure(result.rows[0]) : null;
}

export async function getApprovedProcedureForSignature(pool, faultSignature) {
  const procedureQuery = `
    select id, fault_signature, title, source_reference, status, approved_at, created_at
    from repair_procedures
    where fault_signature = $1 and status = 'approved'
    order by approved_at desc, id
    limit 1;
  `;
  const procedureResult = await pool.query(procedureQuery, [faultSignature]);
  if (procedureResult.rows.length === 0) {
    return null;
  }

  const procedure = mapRepairProcedure(procedureResult.rows[0]);

  const stepsQuery = `
    select id, procedure_id, step_order, instruction, source_location
    from repair_steps
    where procedure_id = $1
    order by step_order;
  `;
  const stepsResult = await pool.query(stepsQuery, [procedure.id]);
  const steps = stepsResult.rows.map(mapRepairStep);

  return { procedure, steps };
}
