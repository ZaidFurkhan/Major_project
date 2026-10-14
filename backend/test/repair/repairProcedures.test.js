import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import {
  createRepairProcedure,
  addRepairStep,
  approveRepairProcedure,
  getApprovedProcedureForSignature,
} from '../../src/db/repairProcedures.js';

describe('repair procedure repository', () => {
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

  it('a procedure with two steps can be created, approved, and read back with steps in step_order', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'vibration_elevated',
      title: 'TEST FIXTURE: Vibration repair procedure',
      sourceReference: 'Service Manual Section 3',
    });

    assert.ok(procedure.id);
    assert.equal(procedure.faultSignature, 'vibration_elevated');
    assert.equal(procedure.title, 'TEST FIXTURE: Vibration repair procedure');
    assert.equal(procedure.sourceReference, 'Service Manual Section 3');
    assert.equal(procedure.status, 'draft');
    assert.equal(procedure.approvedAt, null);
    assert.ok(procedure.createdAt instanceof Date);

    const step2 = await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 2,
      instruction: 'TEST FIXTURE: Step two instruction',
      sourceLocation: 'Section 3.2',
    });
    assert.ok(step2.id);
    assert.equal(step2.procedureId, procedure.id);
    assert.equal(step2.stepOrder, 2);
    assert.equal(step2.instruction, 'TEST FIXTURE: Step two instruction');
    assert.equal(step2.sourceLocation, 'Section 3.2');

    const step1 = await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Step one instruction',
      sourceLocation: 'Section 3.1',
    });
    assert.ok(step1.id);
    assert.equal(step1.stepOrder, 1);

    const approved = await approveRepairProcedure(pool, procedure.id);
    assert.ok(approved);
    assert.equal(approved.id, procedure.id);
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedAt instanceof Date);

    const retrieved = await getApprovedProcedureForSignature(pool, 'vibration_elevated');
    assert.ok(retrieved);
    assert.equal(retrieved.procedure.id, procedure.id);
    assert.equal(retrieved.procedure.status, 'approved');
    assert.equal(retrieved.steps.length, 2);
    assert.equal(retrieved.steps[0].stepOrder, 1);
    assert.equal(retrieved.steps[0].instruction, 'TEST FIXTURE: Step one instruction');
    assert.equal(retrieved.steps[0].sourceLocation, 'Section 3.1');
    assert.equal(retrieved.steps[1].stepOrder, 2);
    assert.equal(retrieved.steps[1].instruction, 'TEST FIXTURE: Step two instruction');
    assert.equal(retrieved.steps[1].sourceLocation, 'Section 3.2');
  });

  it('approveRepairProcedure returns null for a procedure with no steps', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'overheating',
      title: 'TEST FIXTURE: Empty procedure',
      sourceReference: 'Doc Ref A',
    });

    const approved = await approveRepairProcedure(pool, procedure.id);
    assert.equal(approved, null);
  });

  it('approveRepairProcedure returns null when called twice on the same procedure', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'abnormal_load',
      title: 'TEST FIXTURE: Single approval procedure',
      sourceReference: 'Doc Ref B',
    });

    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Initial step',
      sourceLocation: 'Doc Ref B Page 1',
    });

    const firstApproval = await approveRepairProcedure(pool, procedure.id);
    assert.ok(firstApproval);
    assert.equal(firstApproval.status, 'approved');

    const secondApproval = await approveRepairProcedure(pool, procedure.id);
    assert.equal(secondApproval, null);
  });

  it('a step with step_order 0 is rejected by the database', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'rpm_deviation',
      title: 'TEST FIXTURE: Zero order step test',
      sourceReference: 'Doc Ref C',
    });

    await assert.rejects(async () => {
      await addRepairStep(pool, {
        procedureId: procedure.id,
        stepOrder: 0,
        instruction: 'TEST FIXTURE: Invalid step order',
        sourceLocation: 'Doc Ref C Page 1',
      });
    });
  });

  it('a procedure with an invalid fault_signature is rejected by the database', async () => {
    await assert.rejects(async () => {
      await createRepairProcedure(pool, {
        faultSignature: 'invalid_signature_name',
        title: 'TEST FIXTURE: Invalid signature test',
        sourceReference: 'Doc Ref D',
      });
    });
  });

  it('a draft procedure is not returned by getApprovedProcedureForSignature', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'rpm_deviation',
      title: 'TEST FIXTURE: Draft only procedure',
      sourceReference: 'Doc Ref E',
    });

    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Draft step',
      sourceLocation: 'Doc Ref E Page 1',
    });

    const retrieved = await getApprovedProcedureForSignature(pool, 'rpm_deviation');
    assert.equal(retrieved, null);
  });

  it('when two procedures are approved for the same signature, the most recently approved one is returned', async () => {
    const firstProc = await createRepairProcedure(pool, {
      faultSignature: 'overheating',
      title: 'TEST FIXTURE: First overheating procedure',
      sourceReference: 'Doc Ref F1',
    });
    await addRepairStep(pool, {
      procedureId: firstProc.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: First procedure step',
      sourceLocation: 'Doc Ref F1 Page 1',
    });
    const firstApproved = await approveRepairProcedure(pool, firstProc.id);
    assert.ok(firstApproved);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const secondProc = await createRepairProcedure(pool, {
      faultSignature: 'overheating',
      title: 'TEST FIXTURE: Second overheating procedure',
      sourceReference: 'Doc Ref F2',
    });
    await addRepairStep(pool, {
      procedureId: secondProc.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Second procedure step',
      sourceLocation: 'Doc Ref F2 Page 1',
    });
    const secondApproved = await approveRepairProcedure(pool, secondProc.id);
    assert.ok(secondApproved);

    const retrieved = await getApprovedProcedureForSignature(pool, 'overheating');
    assert.ok(retrieved);
    assert.equal(retrieved.procedure.id, secondProc.id);
    assert.equal(retrieved.procedure.title, 'TEST FIXTURE: Second overheating procedure');
  });

  it('deleting a procedure deletes its steps (cascade)', async () => {
    const procedure = await createRepairProcedure(pool, {
      faultSignature: 'abnormal_load',
      title: 'TEST FIXTURE: Cascade delete procedure',
      sourceReference: 'Doc Ref G',
    });
    await addRepairStep(pool, {
      procedureId: procedure.id,
      stepOrder: 1,
      instruction: 'TEST FIXTURE: Step to be cascaded',
      sourceLocation: 'Doc Ref G Page 1',
    });

    const beforeDelete = await pool.query('select count(*) from repair_steps where procedure_id = $1;', [procedure.id]);
    assert.equal(Number(beforeDelete.rows[0].count), 1);

    await pool.query('delete from repair_procedures where id = $1;', [procedure.id]);

    const afterDelete = await pool.query('select count(*) from repair_steps where procedure_id = $1;', [procedure.id]);
    assert.equal(Number(afterDelete.rows[0].count), 0);
  });
});
