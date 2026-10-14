import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import { createMachine } from '../../src/db/machines.js';
import { createServiceCase, getServiceCase } from '../../src/db/serviceCases.js';
import {
  insertVerificationResult,
  listVerificationResultsForCase,
} from '../../src/db/verificationResults.js';

describe('verification results repository', () => {
  let pool;
  let machine;
  let serviceCase;

  before(async () => {
    pool = await openTestPool();
    await pool.query(
      'TRUNCATE verification_results, service_cases, machines RESTART IDENTITY CASCADE;'
    );
    machine = await createMachine(pool, {
      name: 'TEST FIXTURE: Verification Test Motor',
      type: 'TEST FIXTURE: induction',
      location: 'TEST FIXTURE: Bay 1',
    });
    serviceCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Elevated vibration symptom',
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('inserting a PASS result with empty detectedSignatures succeeds and reads back with the same fields', async () => {
    const evidenceData = {
      baseline: { vibrationRmsG: 0.5 },
      window: { vibrationRmsG: 0.51 },
      signatures: [],
    };

    const inserted = await insertVerificationResult(pool, {
      serviceCaseId: serviceCase.id,
      targetSignature: 'vibration_elevated',
      status: 'PASS',
      reason: 'TEST FIXTURE: no fault signature in post-repair window relative to baseline',
      detectedSignatures: [],
      evidence: evidenceData,
      uncertainty: 'TEST FIXTURE: compares post-repair readings with supplied baseline only',
    });

    assert.ok(inserted.id);
    assert.equal(inserted.serviceCaseId, serviceCase.id);
    assert.equal(inserted.targetSignature, 'vibration_elevated');
    assert.equal(inserted.status, 'PASS');
    assert.equal(
      inserted.reason,
      'TEST FIXTURE: no fault signature in post-repair window relative to baseline'
    );
    assert.deepEqual(inserted.detectedSignatures, []);
    assert.equal(typeof inserted.evidence, 'object');
    assert.deepEqual(inserted.evidence, evidenceData);
    assert.equal(
      inserted.uncertainty,
      'TEST FIXTURE: compares post-repair readings with supplied baseline only'
    );
    assert.ok(inserted.createdAt instanceof Date);
  });

  it('inserting a FAIL result with detectedSignatures vibration_elevated reads back with that array', async () => {
    const evidenceData = {
      baseline: { vibrationRmsG: 0.5 },
      window: { vibrationRmsG: 2.5 },
      signatures: [{ type: 'vibration_elevated' }],
    };

    const inserted = await insertVerificationResult(pool, {
      serviceCaseId: serviceCase.id,
      targetSignature: 'vibration_elevated',
      status: 'FAIL',
      reason: 'TEST FIXTURE: target fault still present after repair',
      detectedSignatures: ['vibration_elevated'],
      evidence: evidenceData,
      uncertainty: 'TEST FIXTURE: compares post-repair readings with supplied baseline only',
    });

    assert.ok(inserted.id);
    assert.equal(inserted.status, 'FAIL');
    assert.deepEqual(inserted.detectedSignatures, ['vibration_elevated']);

    const results = await listVerificationResultsForCase(pool, serviceCase.id);
    const found = results.find((r) => r.id === inserted.id);
    assert.ok(found);
    assert.deepEqual(found.detectedSignatures, ['vibration_elevated']);
    assert.equal(typeof found.evidence, 'object');
    assert.deepEqual(found.evidence, evidenceData);
  });

  it('listVerificationResultsForCase returns results in insertion order and returns empty array for a case with none', async () => {
    const emptyCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Empty case symptom',
    });

    const emptyResults = await listVerificationResultsForCase(pool, emptyCase.id);
    assert.deepEqual(emptyResults, []);

    const results = await listVerificationResultsForCase(pool, serviceCase.id);
    assert.ok(results.length >= 2);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i].createdAt >= results[i - 1].createdAt);
    }
  });

  it('a status of RESOLVED is rejected by the database', async () => {
    await assert.rejects(async () => {
      await insertVerificationResult(pool, {
        serviceCaseId: serviceCase.id,
        targetSignature: 'vibration_elevated',
        status: 'RESOLVED',
        reason: 'TEST FIXTURE: resolved status test',
        detectedSignatures: [],
        evidence: {},
        uncertainty: 'TEST FIXTURE: uncertainty statement',
      });
    });
  });

  it('a target_signature that is not one of the four is rejected by the database', async () => {
    await assert.rejects(async () => {
      await insertVerificationResult(pool, {
        serviceCaseId: serviceCase.id,
        targetSignature: 'bearing_flaking',
        status: 'PASS',
        reason: 'TEST FIXTURE: invalid target signature test',
        detectedSignatures: [],
        evidence: {},
        uncertainty: 'TEST FIXTURE: uncertainty statement',
      });
    });
  });

  it('a serviceCaseId that does not exist is rejected by the database', async () => {
    const nonExistentCaseId = '00000000-0000-0000-0000-000000000000';
    await assert.rejects(async () => {
      await insertVerificationResult(pool, {
        serviceCaseId: nonExistentCaseId,
        targetSignature: 'overheating',
        status: 'PASS',
        reason: 'TEST FIXTURE: non-existent case id test',
        detectedSignatures: [],
        evidence: {},
        uncertainty: 'TEST FIXTURE: uncertainty statement',
      });
    });
  });

  it('insertVerificationResult throws when detectedSignatures contains an unknown signature string', async () => {
    await assert.rejects(
      async () => {
        await insertVerificationResult(pool, {
          serviceCaseId: serviceCase.id,
          targetSignature: 'overheating',
          status: 'FAIL',
          reason: 'TEST FIXTURE: unknown detected signature test',
          detectedSignatures: ['unknown_fault_signature'],
          evidence: {},
          uncertainty: 'TEST FIXTURE: uncertainty statement',
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('unknown_fault_signature'));
        return true;
      }
    );
  });

  it('deleting the service case deletes its verification results (cascade)', async () => {
    const temporaryCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Temporary case for cascade test',
    });

    const result = await insertVerificationResult(pool, {
      serviceCaseId: temporaryCase.id,
      targetSignature: 'abnormal_load',
      status: 'PASS',
      reason: 'TEST FIXTURE: cascade test verification result',
      detectedSignatures: [],
      evidence: { verified: true },
      uncertainty: 'TEST FIXTURE: uncertainty statement',
    });

    const beforeDelete = await listVerificationResultsForCase(pool, temporaryCase.id);
    assert.equal(beforeDelete.length, 1);
    assert.equal(beforeDelete[0].id, result.id);

    await pool.query('delete from service_cases where id = $1;', [temporaryCase.id]);

    const afterDelete = await listVerificationResultsForCase(pool, temporaryCase.id);
    assert.deepEqual(afterDelete, []);
  });

  it('inserting a result does not change the status of the service case', async () => {
    const caseBefore = await getServiceCase(pool, serviceCase.id);
    assert.ok(caseBefore);
    assert.equal(caseBefore.status, 'open');

    await insertVerificationResult(pool, {
      serviceCaseId: serviceCase.id,
      targetSignature: 'rpm_deviation',
      status: 'PASS',
      reason: 'TEST FIXTURE: service case status unchanged test',
      detectedSignatures: [],
      evidence: {},
      uncertainty: 'TEST FIXTURE: uncertainty statement',
    });

    const caseAfter = await getServiceCase(pool, serviceCase.id);
    assert.ok(caseAfter);
    assert.deepEqual(caseBefore, caseAfter);
    assert.equal(caseAfter.status, 'open');
  });
});
