import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import {
  createRepairProcedure,
  addRepairStep,
  approveRepairProcedure,
} from '../../src/db/repairProcedures.js';
import { getRepairGuide, ALLOWED_FAULT_SIGNATURES } from '../../src/repair/guide.js';

describe('repair guide module', () => {
  let pool;

  before(async () => {
    pool = await openTestPool();
    await pool.query('TRUNCATE repair_steps, repair_procedures RESTART IDENTITY CASCADE;');
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('invalid signature returns status invalid_signature and does not query the database', async () => {
    const throwingPool = {
      query: () => {
        throw new Error('Database query should not have been called');
      },
    };

    const result = await getRepairGuide(throwingPool, 'unrecognized_signature');
    assert.equal(result.status, 'invalid_signature');
    assert.deepEqual(result.allowed, ALLOWED_FAULT_SIGNATURES);
  });

  it('signature with no approved procedure returns no_approved_procedure with empty steps', async () => {
    const result = await getRepairGuide(pool, 'rpm_deviation');
    assert.deepEqual(result, {
      status: 'no_approved_procedure',
      faultSignature: 'rpm_deviation',
      steps: [],
    });
  });

  it('signature with an approved procedure returns found with ordered steps matching stored text', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'vibration_elevated',
      title: 'TEST FIXTURE: Vibration remediation guide',
      sourceReference: 'Manual Section 4',
    });

    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 2,
      instruction: 'TEST FIXTURE: Inspect motor mounting bolts and retighten to specification',
      sourceLocation: 'Manual Section 4.2',
    });

    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: De-energize and lock out motor power supply',
      sourceLocation: 'Manual Section 4.1',
    });

    const approved = await approveRepairProcedure(pool, procedure.id);
    assert.ok(approved);

    const result = await getRepairGuide(pool, 'vibration_elevated');
    assert.equal(result.status, 'found');
    assert.equal(result.faultSignature, 'vibration_elevated');
    assert.equal(result.procedure.id, procedure.id);
    assert.equal(result.procedure.title, 'TEST FIXTURE: Vibration remediation guide');
    assert.equal(result.procedure.sourceReference, 'Manual Section 4');
    assert.ok(result.procedure.approvedAt instanceof Date);
    assert.deepEqual(result.steps, [
      {
        stepOrder: 1,
        instruction: 'TEST FIXTURE: De-energize and lock out motor power supply',
        sourceLocation: 'Manual Section 4.1',
      },
      {
        stepOrder: 2,
        instruction: 'TEST FIXTURE: Inspect motor mounting bolts and retighten to specification',
        sourceLocation: 'Manual Section 4.2',
      },
    ]);
  });

  it('draft-only signature returns no_approved_procedure', async () => {
    const draftProcedure = await createRepairProcedure(pool, {
      faultSignature: 'abnormal_load',
      title: 'TEST FIXTURE: Draft abnormal load guide',
      sourceReference: 'Manual Section 5',
    });

    await addRepairStep(pool, {
      procedureId: draftProcedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Check mechanical coupling for binding',
      sourceLocation: 'Manual Section 5.1',
    });

    const result = await getRepairGuide(pool, 'abnormal_load');
    assert.deepEqual(result, {
      status: 'no_approved_procedure',
      faultSignature: 'abnormal_load',
      steps: [],
    });
  });
});
