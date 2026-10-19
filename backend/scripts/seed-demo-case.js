import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createMachine, listMachines } from '../src/db/machines.js';
import {
  createServiceCase,
  getServiceCase,
  listServiceCasesForMachine,
} from '../src/db/serviceCases.js';
import { insertDiagnosis, listDiagnosesForCase } from '../src/db/diagnoses.js';
import { createSimulator } from '../src/simulator/simulator.js';
import { diagnose } from '../src/diagnosis/diagnose.js';
import { validateReading } from '../src/telemetry/contract.js';

// Number of simulated readings required to form the diagnosis window.
const READING_COUNT = 20;

// Deterministic seed for the overheating simulator scenario.
const SIMULATOR_SEED = 4;

// Number of baseline readings used by the anomaly detector.
const BASELINE_COUNT = 10;

// Number of window readings evaluated against the baseline.
const WINDOW_COUNT = 10;

const MACHINE_NAME = 'Motor Test Rig';
const MACHINE_TYPE = 'test_rig';
const MACHINE_LOCATION = 'Demo bench';
const DETECTED_SYMPTOM = 'Demo case: overheating (simulated)';
const FIXED_START_TIME = '2026-01-01T00:00:00.000Z';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.error('Set DATABASE_URL before running this script.');
    process.exit(1);
  }

  let dbName;
  try {
    const parsed = new URL(databaseUrl);
    dbName = parsed.pathname.replace(/^\//, '');
  } catch {
    console.error('Refusing to seed: database name must be mechsense_dev.');
    process.exit(1);
  }

  if (dbName !== 'mechsense_dev') {
    console.error('Refusing to seed: database name must be mechsense_dev.');
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  let migrationsDir = path.resolve(scriptDir, '../../database/migrations');
  try {
    await fs.access(migrationsDir);
  } catch {
    migrationsDir = path.resolve(scriptDir, '../database/migrations');
  }

  const pool = createPool(databaseUrl);

  try {
    await runMigrations(pool, migrationsDir);

    const machines = await listMachines(pool);
    let machine = machines.find((m) => m.name === MACHINE_NAME);
    if (!machine) {
      machine = await createMachine(pool, {
        name: MACHINE_NAME,
        type: MACHINE_TYPE,
        location: MACHINE_LOCATION,
      });
    }

    const existingCases = await listServiceCasesForMachine(pool, machine.id);
    const existingCase = existingCases.find(
      (c) => c.detectedSymptom === DETECTED_SYMPTOM
    );

    let activeCase;
    let diagnosisStatus;
    let candidatesCount;

    if (existingCase) {
      activeCase = existingCase;
      const diagnoses = await listDiagnosesForCase(pool, existingCase.id);
      if (diagnoses.length > 0) {
        diagnosisStatus = diagnoses[0].status;
        candidatesCount = diagnoses[0].candidates?.length ?? 0;
      } else {
        diagnosisStatus = 'diagnosed';
        candidatesCount = 0;
      }
    } else {
      activeCase = await createServiceCase(pool, {
        machineId: machine.id,
        detectedSymptom: DETECTED_SYMPTOM,
      });

      const simulator = createSimulator({
        machineId: machine.id,
        scenario: 'overheating',
        seed: SIMULATOR_SEED,
        startTime: FIXED_START_TIME,
      });

      const readings = [];
      for (let i = 0; i < READING_COUNT; i++) {
        const raw = simulator.next();
        const validation = validateReading(raw);
        if (!validation.valid) {
          console.error(
            `Invalid reading at index ${i}: ${validation.errors.join(', ')}`
          );
          process.exit(1);
        }
        readings.push(validation.value);
      }

      const diagnosisResult = diagnose(readings, {
        baselineCount: BASELINE_COUNT,
        windowCount: WINDOW_COUNT,
      });

      if (diagnosisResult.status !== 'diagnosed') {
        console.error(
          `Diagnosis status is "${diagnosisResult.status}", expected "diagnosed".`
        );
        process.exit(1);
      }

      await insertDiagnosis(pool, {
        serviceCaseId: activeCase.id,
        diagnosis: diagnosisResult,
      });

      const diagnoses = await listDiagnosesForCase(pool, activeCase.id);
      if (diagnoses.length !== 1) {
        console.error(
          `Expected 1 stored diagnosis, found ${diagnoses.length}.`
        );
        process.exit(1);
      }

      diagnosisStatus = diagnoses[0].status;
      candidatesCount = diagnoses[0].candidates?.length ?? 0;

      const reloadedCase = await getServiceCase(pool, activeCase.id);
      if (!reloadedCase || reloadedCase.status !== 'open') {
        console.error(
          `Case status is "${reloadedCase?.status}", expected "open".`
        );
        process.exit(1);
      }
    }

    console.log('--------------------------------------------------');
    console.log('Demo Service Case');
    console.log(`Machine Name:     ${machine.name}`);
    console.log(`Case ID:          ${activeCase.id}`);
    console.log(`Case Status:      ${activeCase.status}`);
    console.log(`Diagnosis Status: ${diagnosisStatus}`);
    console.log(`Candidates:       ${candidatesCount}`);
    console.log(
      'Set CASE_ID in mobile/src/monitorSettings.js to this case ID on your PC. Do not commit that change.'
    );
    console.log('--------------------------------------------------');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error seeding demo service case:', err.message);
  process.exit(1);
});
