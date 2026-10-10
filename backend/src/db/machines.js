function mapMachine(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    createdAt: row.created_at,
  };
}

export async function createMachine(pool, { name, type, location = null }) {
  const query = `
    insert into machines (name, type, location)
    values ($1, $2, $3)
    returning id, name, type, location, created_at;
  `;
  const result = await pool.query(query, [name, type, location]);
  return mapMachine(result.rows[0]);
}

export async function getMachine(pool, id) {
  const query = `
    select id, name, type, location, created_at
    from machines
    where id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows.length > 0 ? mapMachine(result.rows[0]) : null;
}

export async function listMachines(pool) {
  const query = `
    select id, name, type, location, created_at
    from machines
    order by name, id;
  `;
  const result = await pool.query(query);
  return result.rows.map(mapMachine);
}
