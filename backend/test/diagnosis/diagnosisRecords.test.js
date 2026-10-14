import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openTestPool } from '../helpers/testDb.js';
import { createMachine } from '../../src/db/machines.js';
import { createServiceCase, getServiceCase } from '../../src/db/serviceCases.js';
import { insertDiagnosis, listDiagnosesForCase } from '../../src/db/diagnoses.js';
import { diagnose } from '../../src/diagnosis/diagnose.js';
import { createSimulator } from '../../src/simulator/simulator.js';

describe('diagnosis records repository', () => {
  let pool;
  let machine;
  let serviceCase;

  before(async () => {
    pool = await openTestPool();
    await pool.query(
      'TRUNCATE diagnoses, verification_results, service_cases, machines RESTART IDENTITY CASCADE;'
    );
    machine = await createMachine(pool, {
      name: 'TEST FIXTURE: Diagnosis Test Motor',
      type: 'TEST FIXTURE: induction',
      location: 'TEST FIXTURE: Test Bay 1',
    });
    serviceCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Vibration fault detected',
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('storing a diagnosed result from diagnose on a vibration_anomaly window reads back with the same signatures, candidates, dataSources, and uncertainty', async () => {
    const sim = createSimulator({
      machineId: 'TEST FIXTURE: motor-rig-1',
      scenario: 'vibration_anomaly',
      seed: 1,
    });
    const readings = [];
    for (let i = 0; i < 20; i++) {
      readings.push(sim.next());
    }

    const diagnosisResult = diagnose(readings);
    assert.equal(diagnosisResult.status, 'diagnosed');
    assert.ok(diagnosisResult.candidates.length > 0);

    const inserted = await insertDiagnosis(pool, {
      serviceCaseId: serviceCase.id,
      diagnosis: diagnosisResult,
    });

    const expectedSignatures = diagnosisResult.signatures.map((s) => s.type);

    assert.ok(inserted.id);
    assert.equal(inserted.serviceCaseId, serviceCase.id);
    assert.equal(inserted.status, 'diagnosed');
    assert.deepEqual(inserted.signatures, expectedSignatures);
    assert.deepEqual(inserted.candidates, diagnosisResult.candidates);
    assert.deepEqual(inserted.dataSources, diagnosisResult.dataSources);
    assert.equal(inserted.uncertainty, diagnosisResult.uncertainty);
    assert.ok(inserted.createdAt instanceof Date);

    const listed = await listDiagnosesForCase(pool, serviceCase.id);
    const found = listed.find((d) => d.id === inserted.id);
    assert.ok(found);
    assert.equal(found.status, 'diagnosed');
    assert.deepEqual(found.signatures, expectedSignatures);
    assert.deepEqual(found.candidates, diagnosisResult.candidates);
    assert.deepEqual(found.dataSources, diagnosisResult.dataSources);
    assert.equal(found.uncertainty, diagnosisResult.uncertainty);
  });

  it('storing an inconclusive result from diagnose on a normal window reads back with status inconclusive and empty signatures', async () => {
    const sim = createSimulator({
      machineId: 'TEST FIXTURE: motor-rig-1',
      scenario: 'normal',
      seed: 1,
    });
    const readings = [];
    for (let i = 0; i < 20; i++) {
      readings.push(sim.next());
    }

    const inconclusiveResult = diagnose(readings);
    assert.equal(inconclusiveResult.status, 'inconclusive');

    const inserted = await insertDiagnosis(pool, {
      serviceCaseId: serviceCase.id,
      diagnosis: inconclusiveResult,
    });

    assert.ok(inserted.id);
    assert.equal(inserted.status, 'inconclusive');
    assert.deepEqual(inserted.signatures, []);
    assert.deepEqual(inserted.candidates, []);
    assert.deepEqual(inserted.dataSources, inconclusiveResult.dataSources);
    assert.equal(inserted.uncertainty, inconclusiveResult.uncertainty);

    const listed = await listDiagnosesForCase(pool, serviceCase.id);
    const found = listed.find((d) => d.id === inserted.id);
    assert.ok(found);
    assert.equal(found.status, 'inconclusive');
    assert.deepEqual(found.signatures, []);
    assert.deepEqual(found.candidates, []);
  });

  it('insertDiagnosis throws, without writing a row, for a status of insufficient_data and for invalid_input', async () => {
    const countBefore = (await listDiagnosesForCase(pool, serviceCase.id)).length;

    await assert.rejects(async () => {
      await insertDiagnosis(pool, {
        serviceCaseId: serviceCase.id,
        diagnosis: {
          status: 'insufficient_data',
          candidates: [],
          dataSources: ['simulated'],
          uncertainty: 'TEST FIXTURE: uncertainty',
        },
      });
    });

    const countAfterFirst = (await listDiagnosesForCase(pool, serviceCase.id)).length;
    assert.equal(countAfterFirst, countBefore);

    await assert.rejects(async () => {
      await insertDiagnosis(pool, {
        serviceCaseId: serviceCase.id,
        diagnosis: {
          status: 'invalid_input',
          candidates: [],
          dataSources: [],
          uncertainty: 'TEST FIXTURE: uncertainty',
        },
      });
    });

    const countAfterSecond = (await listDiagnosesForCase(pool, serviceCase.id)).length;
    assert.equal(countAfterSecond, countBefore);
  });

  it('insertDiagnosis throws when signatures contains an unknown type', async () => {
    const countBefore = (await listDiagnosesForCase(pool, serviceCase.id)).length;

    await assert.rejects(
      async () => {
        await insertDiagnosis(pool, {
          serviceCaseId: serviceCase.id,
          diagnosis: {
            status: 'diagnosed',
            signatures: ['unknown_fault_type'],
            candidates: [],
            dataSources: ['simulated'],
            uncertainty: 'TEST FIXTURE: uncertainty',
          },
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('unknown_fault_type'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await insertDiagnosis(pool, {
          serviceCaseId: serviceCase.id,
          diagnosis: {
            status: 'diagnosed',
            signatures: [{ type: 'unknown_signature_object' }],
            candidates: [],
            dataSources: ['simulated'],
            uncertainty: 'TEST FIXTURE: uncertainty',
          },
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('unknown_signature_object'));
        return true;
      }
    );

    const countAfter = (await listDiagnosesForCase(pool, serviceCase.id)).length;
    assert.equal(countAfter, countBefore);
  });

  it('listDiagnosesForCase returns records in insertion order and empty array for a case with none', async () => {
    const emptyCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Case with no diagnoses',
    });

    const emptyResults = await listDiagnosesForCase(pool, emptyCase.id);
    assert.deepEqual(emptyResults, []);

    const orderedResults = await listDiagnosesForCase(pool, serviceCase.id);
    assert.ok(orderedResults.length >= 2);
    for (let i = 1; i < orderedResults.length; i++) {
      assert.ok(orderedResults[i].createdAt >= orderedResults[i - 1].createdAt);
    }
  });

  it('deleting the service case deletes its diagnoses (cascade)', async () => {
    const temporaryCase = await createServiceCase(pool, {
      machineId: machine.id,
      detectedSymptom: 'TEST FIXTURE: Cascade delete case',
    });

    const diag = await insertDiagnosis(pool, {
      serviceCaseId: temporaryCase.id,
      diagnosis: {
        status: 'inconclusive',
        candidates: [],
        dataSources: ['simulated'],
        uncertainty: 'TEST FIXTURE: uncertainty',
      },
    });

    const beforeDelete = await listDiagnosesForCase(pool, temporaryCase.id);
    assert.equal(beforeDelete.length, 1);
    assert.equal(beforeDelete[0].id, diag.id);

    await pool.query('delete from service_cases where id = $1;', [temporaryCase.id]);

    const afterDelete = await listDiagnosesForCase(pool, temporaryCase.id);
    assert.deepEqual(afterDelete, []);
  });

  it('inserting a diagnosis does not change the service case status', async () => {
    const caseBefore = await getServiceCase(pool, serviceCase.id);
    assert.ok(caseBefore);
    assert.equal(caseBefore.status, 'open');

    await insertDiagnosis(pool, {
      serviceCaseId: serviceCase.id,
      diagnosis: {
        status: 'inconclusive',
        candidates: [],
        dataSources: ['simulated'],
        uncertainty: 'TEST FIXTURE: uncertainty',
      },
    });

    const caseAfter = await getServiceCase(pool, serviceCase.id);
    assert.ok(caseAfter);
    assert.deepEqual(caseBefore, caseAfter);
    assert.equal(caseAfter.status, 'open');
  });

  it('candidate objects read back with their supportingEvidence and checkNext fields present', async () => {
    const sim = createSimulator({
      machineId: 'TEST FIXTURE: motor-rig-1',
      scenario: 'vibration_anomaly',
      seed: 2,
    });
    const readings = [];
    for (let i = 0; i < 20; i++) {
      readings.push(sim.next());
    }

    const diag = diagnose(readings);
    assert.equal(diag.status, 'diagnosed');
    assert.ok(diag.candidates.length > 0);

    const inserted = await insertDiagnosis(pool, {
      serviceCaseId: serviceCase.id,
      diagnosis: diag,
    });

    assert.ok(inserted.candidates.length > 0);
    for (const candidate of inserted.candidates) {
      assert.ok('supportingEvidence' in candidate);
      assert.ok(Array.isArray(candidate.supportingEvidence));
      assert.ok('checkNext' in candidate);
      assert.ok(typeof candidate.checkNext === 'string' && candidate.checkNext.length > 0);
    }

    const listed = await listDiagnosesForCase(pool, serviceCase.id);
    const found = listed.find((d) => d.id === inserted.id);
    assert.ok(found);
    for (const candidate of found.candidates) {
      assert.ok('supportingEvidence' in candidate);
      assert.ok(Array.isArray(candidate.supportingEvidence));
      assert.ok('checkNext' in candidate);
      assert.ok(typeof candidate.checkNext === 'string' && candidate.checkNext.length > 0);
    }
  });
});
