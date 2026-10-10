import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openTestPool } from '../helpers/testDb.js';
import { createMachine, getMachine, listMachines } from '../../src/db/machines.js';
import {
  createServiceCase,
  getServiceCase,
  listServiceCasesForMachine,
} from '../../src/db/serviceCases.js';

test('machine repository operations and ordering', async () => {
  const pool = await openTestPool();
  try {
    const created = await createMachine(pool, {
      name: 'Vibration Rig Beta',
      type: 'dynamometer',
      location: 'Section 4',
    });

    assert.ok(created.id);
    assert.strictEqual(created.name, 'Vibration Rig Beta');
    assert.strictEqual(created.type, 'dynamometer');
    assert.strictEqual(created.location, 'Section 4');
    assert.ok(created.createdAt instanceof Date);

    const fetched = await getMachine(pool, created.id);
    assert.deepStrictEqual(fetched, created);

    const randomId = crypto.randomUUID();
    const missing = await getMachine(pool, randomId);
    assert.strictEqual(missing, null);

    await createMachine(pool, {
      name: 'Acoustic Rig Alpha',
      type: 'microphone_array',
      location: 'Section 1',
    });

    const machines = await listMachines(pool);
    assert.strictEqual(machines.length, 2);
    assert.strictEqual(machines[0].name, 'Acoustic Rig Alpha');
    assert.strictEqual(machines[1].name, 'Vibration Rig Beta');
  } finally {
    await pool.end();
  }
});

test('service case repository operations and constraints', async () => {
  const pool = await openTestPool();
  try {
    const machine = await createMachine(pool, {
      name: 'Motor Test Rig',
      type: 'test_rig',
      location: 'Bay 2',
    });

    const serviceCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'Bearing temperature above threshold',
    });

    assert.ok(serviceCase.id);
    assert.strictEqual(serviceCase.machineId, machine.id);
    assert.strictEqual(serviceCase.status, 'open');
    assert.strictEqual(
      serviceCase.detectedSymptom,
      'Bearing temperature above threshold'
    );
    assert.ok(serviceCase.createdAt instanceof Date);
    assert.strictEqual(serviceCase.closedAt, null);

    const fetchedCase = await getServiceCase(pool, serviceCase.id);
    assert.deepStrictEqual(fetchedCase, serviceCase);

    const otherMachine = await createMachine(pool, {
      name: 'Secondary Rig',
      type: 'test_rig',
    });
    const otherCase = await createServiceCase(pool, {
      machineId: otherMachine.id,
      detectedSymptom: 'Motor current spike',
    });

    const rigCases = await listServiceCasesForMachine(pool, machine.id);
    assert.strictEqual(rigCases.length, 1);
    assert.strictEqual(rigCases[0].id, serviceCase.id);

    const otherCases = await listServiceCasesForMachine(pool, otherMachine.id);
    assert.strictEqual(otherCases.length, 1);
    assert.strictEqual(otherCases[0].id, otherCase.id);

    await assert.rejects(async () => {
      await pool.query(
        "insert into service_cases (machine_id, status) values ($1, 'invalid_status');",
        [machine.id]
      );
    });

    await assert.rejects(async () => {
      await pool.query(
        "insert into service_cases (machine_id, status, closed_at) values ($1, 'closed', null);",
        [machine.id]
      );
    });

    await assert.rejects(async () => {
      await createServiceCase(pool, {
        machineId: crypto.randomUUID(),
        detectedSymptom: 'Orphan case',
      });
    });
  } finally {
    await pool.end();
  }
});
