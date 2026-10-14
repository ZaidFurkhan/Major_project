import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseReport, renderCaseReportText } from '../../src/report/buildCaseReport.js';

describe('buildCaseReport builder', () => {
  const baseMachine = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'TEST FIXTURE: Dynamometer Alpha',
    type: 'TEST FIXTURE: dynamometer',
    location: 'TEST FIXTURE: Cell 1',
  };

  const baseCase = {
    id: '22222222-2222-2222-2222-222222222222',
    status: 'open',
    detectedSymptom: 'TEST FIXTURE: High vibration detected',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    closedAt: null,
  };

  it('null machine or case returns status not_found', () => {
    assert.deepEqual(buildCaseReport({ machine: null, serviceCase: baseCase }), {
      status: 'not_found',
    });
    assert.deepEqual(buildCaseReport({ machine: baseMachine, serviceCase: null }), {
      status: 'not_found',
    });
    assert.deepEqual(buildCaseReport({ machine: null, serviceCase: null }), {
      status: 'not_found',
    });
    assert.deepEqual(buildCaseReport(), {
      status: 'not_found',
    });
  });

  it('no verifications returns repairOutcome no_verification_recorded and latestVerification null', () => {
    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: [],
    });

    assert.equal(report.status, 'ok');
    assert.equal(report.repairOutcome, 'no_verification_recorded');
    assert.equal(report.latestVerification, null);
    assert.deepEqual(report.verifications, []);
  });

  it('latest PASS returns verified', () => {
    const verifications = [
      {
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        status: 'FAIL',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Still vibrating',
        detectedSignatures: ['vibration_elevated'],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
      {
        createdAt: new Date('2026-01-01T02:00:00.000Z'),
        status: 'PASS',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Normal readings',
        detectedSignatures: [],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
    ];

    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: verifications,
    });

    assert.equal(report.status, 'ok');
    assert.equal(report.repairOutcome, 'verified');
    assert.equal(report.latestVerification.status, 'PASS');
  });

  it('latest FAIL returns not_verified even if an earlier result was PASS', () => {
    const verifications = [
      {
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        status: 'PASS',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Temporarily normal',
        detectedSignatures: [],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
      {
        createdAt: new Date('2026-01-01T02:00:00.000Z'),
        status: 'FAIL',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Fault recurred',
        detectedSignatures: ['vibration_elevated'],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
    ];

    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: verifications,
    });

    assert.equal(report.status, 'ok');
    assert.equal(report.repairOutcome, 'not_verified');
    assert.equal(report.latestVerification.status, 'FAIL');
  });

  it('latest INCONCLUSIVE returns not_verified', () => {
    const verifications = [
      {
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        status: 'INCONCLUSIVE',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Different signature',
        detectedSignatures: ['overheating'],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
    ];

    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: verifications,
    });

    assert.equal(report.status, 'ok');
    assert.equal(report.repairOutcome, 'not_verified');
    assert.equal(report.latestVerification.status, 'INCONCLUSIVE');
  });

  it('the three required notes are always present', () => {
    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: [],
    });

    assert.ok(
      report.notes.includes(
        'Diagnosis records are not stored in this version of the system.'
      )
    );
    assert.ok(
      report.notes.includes(
        'Verification compares post-repair readings with the supplied baseline only and does not prove the cause was repaired.'
      )
    );
    assert.ok(
      report.notes.includes(
        'Simulated readings must not be used for a real machine decision.'
      )
    );
  });

  it('a closed case with no PASS includes the extra closed-without-PASS note', () => {
    const closedCase = {
      ...baseCase,
      status: 'closed',
      closedAt: new Date('2026-01-01T03:00:00.000Z'),
    };

    const reportNoVerif = buildCaseReport({
      machine: baseMachine,
      serviceCase: closedCase,
      verificationResults: [],
    });

    assert.ok(
      reportNoVerif.notes.includes(
        'Case is closed without a PASS verification; review before relying on it.'
      )
    );

    const reportWithFail = buildCaseReport({
      machine: baseMachine,
      serviceCase: closedCase,
      verificationResults: [
        {
          createdAt: new Date('2026-01-01T01:00:00.000Z'),
          status: 'FAIL',
          targetSignature: 'vibration_elevated',
          reason: 'TEST FIXTURE: Still faulty',
          detectedSignatures: ['vibration_elevated'],
          uncertainty: 'TEST FIXTURE: Baseline comparison only',
        },
      ],
    });

    assert.ok(
      reportWithFail.notes.includes(
        'Case is closed without a PASS verification; review before relying on it.'
      )
    );

    const reportWithPass = buildCaseReport({
      machine: baseMachine,
      serviceCase: closedCase,
      verificationResults: [
        {
          createdAt: new Date('2026-01-01T01:00:00.000Z'),
          status: 'PASS',
          targetSignature: 'vibration_elevated',
          reason: 'TEST FIXTURE: Passed',
          detectedSignatures: [],
          uncertainty: 'TEST FIXTURE: Baseline comparison only',
        },
      ],
    });

    assert.equal(
      reportWithPass.notes.includes(
        'Case is closed without a PASS verification; review before relying on it.'
      ),
      false
    );
  });

  it('renderCaseReportText includes the case id and the repair outcome', () => {
    const report = buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: [
        {
          createdAt: new Date('2026-01-01T01:00:00.000Z'),
          status: 'PASS',
          targetSignature: 'vibration_elevated',
          reason: 'TEST FIXTURE: Verified normal',
          detectedSignatures: [],
          uncertainty: 'TEST FIXTURE: Baseline comparison only',
        },
      ],
    });

    const rendered = renderCaseReportText(report);
    assert.ok(rendered.includes(baseCase.id));
    assert.ok(rendered.includes('verified'));
    assert.ok(rendered.includes(baseMachine.name));

    const notFoundRendered = renderCaseReportText({ status: 'not_found' });
    assert.equal(notFoundRendered, 'Case not found.');

    const nullRendered = renderCaseReportText(null);
    assert.equal(nullRendered, 'Case not found.');
  });

  it('inputs are not mutated', () => {
    const machineCopy = structuredClone(baseMachine);
    const caseCopy = structuredClone(baseCase);
    const verifications = [
      {
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
        status: 'PASS',
        targetSignature: 'vibration_elevated',
        reason: 'TEST FIXTURE: Pass',
        detectedSignatures: [],
        uncertainty: 'TEST FIXTURE: Baseline comparison only',
      },
    ];
    const verificationsCopy = structuredClone(verifications);

    buildCaseReport({
      machine: baseMachine,
      serviceCase: baseCase,
      verificationResults: verifications,
    });

    assert.deepEqual(baseMachine, machineCopy);
    assert.deepEqual(baseCase, caseCopy);
    assert.deepEqual(verifications, verificationsCopy);
  });
});
