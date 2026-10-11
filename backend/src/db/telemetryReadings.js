function toIsoString(dateOrString) {
  if (!dateOrString) return null;
  return dateOrString instanceof Date ? dateOrString.toISOString() : new Date(dateOrString).toISOString();
}

function mapTelemetryReading(row) {
  if (!row) {
    return null;
  }

  const reading = {
    machineId: row.machine_id,
    timestamp: toIsoString(row.recorded_at),
    source: row.source,
    scenario: row.scenario ?? null,
    temperatureC: Number(row.temperature_c),
    vibrationRmsG: Number(row.vibration_rms_g),
    currentA: Number(row.current_a),
    rpm: Number(row.rpm),
    commandedRpm: row.commanded_rpm !== null ? Number(row.commanded_rpm) : null,
  };

  if (row.data_window_samples !== null || row.data_dropout_count !== null) {
    reading.dataQuality = {
      windowSamples: row.data_window_samples !== null ? Number(row.data_window_samples) : null,
      dropoutCount: row.data_dropout_count !== null ? Number(row.data_dropout_count) : null,
    };
  }

  reading.receivedAt = toIsoString(row.received_at);

  return reading;
}

export async function insertTelemetryReading(pool, reading) {
  const query = `
    insert into telemetry_readings (
      machine_id,
      recorded_at,
      source,
      scenario,
      temperature_c,
      vibration_rms_g,
      current_a,
      rpm,
      commanded_rpm,
      data_window_samples,
      data_dropout_count
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    on conflict (machine_id, source, recorded_at) do nothing
    returning id;
  `;

  const values = [
    reading.machineId,
    reading.timestamp,
    reading.source,
    reading.scenario ?? null,
    reading.temperatureC,
    reading.vibrationRmsG,
    reading.currentA,
    reading.rpm,
    reading.commandedRpm ?? null,
    reading.dataQuality?.windowSamples ?? null,
    reading.dataQuality?.dropoutCount ?? null,
  ];

  const result = await pool.query(query, values);
  if (result.rows.length > 0) {
    return { inserted: true, id: result.rows[0].id };
  }
  return { inserted: false };
}

export async function getLatestTelemetryReading(pool, machineId) {
  const query = `
    select
      id,
      machine_id,
      recorded_at,
      source,
      scenario,
      temperature_c,
      vibration_rms_g,
      current_a,
      rpm,
      commanded_rpm,
      data_window_samples,
      data_dropout_count,
      received_at
    from telemetry_readings
    where machine_id = $1
    order by recorded_at desc, id desc
    limit 1;
  `;

  const result = await pool.query(query, [machineId]);
  return result.rows.length > 0 ? mapTelemetryReading(result.rows[0]) : null;
}
