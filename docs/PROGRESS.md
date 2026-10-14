# MechSense Project Progress

## 1. Project Summary

MechSense is an AI-assisted predictive-maintenance and fault diagnosis system for an electric motor test rig. It monitors operating channels including temperature, vibration, current, and rotational speed to detect abnormal conditions. The system guides operators through fault isolation, recommended repairs, and post-repair verification to ensure operational reliability.

## 2. Current Status

As of October 14, 2026, the repository contains 29 commits on main, 113 passing backend tests across 16 suites, and 2 passing AI service tests. The core backend pipeline for telemetry simulation, database persistence, MQTT ingestion, WebSocket live broadcast, latest-reading REST query, deterministic anomaly detection, candidate-cause diagnosis, approved repair procedure storage and lookup, and post-repair verification decision logic is implemented, while AI service integrations, report generation, and mobile interfaces remain in early scaffolding.

## 3. Completed Work

| Date | Commit | What it added |
| --- | --- | --- |
| 2026-10-10 | 0b1ce23 | Initial monorepo layout and placeholder directories |
| 2026-10-10 | 1e3606c | Backend and AI service health endpoint skeletons |
| 2026-10-10 | 645c4e8 | Initial SQL schema for machines and service cases |
| 2026-10-10 | 8b1fd4e | PostgreSQL connection pool factory and schema migration runner |
| 2026-10-10 | 1eab94f | Machine and service case database repository functions |
| 2026-10-10 | 537cd56 | Embedded PostgreSQL test runner configuration and pg dependency |
| 2026-10-10 | 65473f0 | Database connection, migration, and repository unit tests |
| 2026-10-10 | 3b5a1b0 | Merge database layer branch into main |
| 2026-10-11 | 44505a0 | Restrict backend test runner discovery to .test.js files |
| 2026-10-11 | e5c2405 | Merge test file discovery fix branch into main |
| 2026-10-11 | 8452cdd | Telemetry reading contract, schema validation, and placeholder thresholds |
| 2026-10-11 | f1f7511 | Seeded deterministic telemetry simulator for normal and fault scenarios |
| 2026-10-11 | 90fc93f | Tests for telemetry contract validation and simulator determinism |
| 2026-10-11 | a46046f | Statistical scenario behavior and window fixture tests for simulator |
| 2026-10-11 | bb3e193 | Telemetry readings database migration and repository queries |
| 2026-10-11 | 8d75e83 | MQTT telemetry ingestion message handler and client dependencies |
| 2026-10-11 | 837b6a6 | MQTT ingestion test suite using in-process Aedes broker |
| 2026-10-11 | aa41b71 | Progress tracking documentation and status update (pushed to origin/main) |
| 2026-10-12 | aebc51b | Staleness rule and WebSocket telemetry broadcaster (pushed to origin/main) |
| 2026-10-12 | 4872d03 | Latest telemetry REST endpoint with staleness flag (pushed to origin/main) |
| 2026-10-12 | b4237f0 | Wire live telemetry delivery into server startup (pushed to origin/main) |
| 2026-10-12 | d403332 | Keep simulator baseline window free of fault ramp (pushed to origin/main) |
| 2026-10-12 | a522b7a | Add explainable anomaly detector for telemetry windows (pushed to origin/main) |
| 2026-10-12 | 3105dbb | Update progress document with live delivery and anomaly detection (pushed to origin/main) |
| 2026-10-12 | ea0066c | Add candidate-cause diagnosis from detected signatures |
| 2026-10-12 | f8980b5 | Update progress document with anomaly detection and diagnosis |
| 2026-10-14 | 4871354 | Add approved repair procedure storage with source references |
| 2026-10-14 | 7766ef5 | Add repair guide lookup that returns only approved steps |
| 2026-10-14 | e17038e | Update progress document with repair guide backend |

## 4. Work in Progress (Not Yet Committed)

The repair verification decision module is implemented in the local working tree and planned for commit. It adds 9 tests, raising the backend test total from 104 to 113 across 16 suites:

- backend/src/verification/verifyRepair.js: pure decision function evaluating post-repair readings against baseline using anomaly detection rules (uncommitted).
- backend/test/verification/verifyRepair.test.js: unit tests for repair verification decisions, error handling, determinism, and uncertainty (9 tests, uncommitted).

## 5. Architecture as Built

- Backend (Node.js/Express): built.
- AI service (Python/FastAPI): partial. Only health and 404 endpoints are implemented.
- PostgreSQL schema: built. Machines, service cases, telemetry readings, repair procedures, and repair steps tables with indexes.
- MQTT ingestion: built. Subscribes to telemetry topics, validates contracts, verifies machines, and stores deduplicated rows.
- WebSocket delivery: built. Broadcasts stored readings to connected clients on /ws/telemetry.
- Simulator: built. Generates seeded deterministic readings for normal operation and four anomaly scenarios.
- Anomaly detection: built. Deterministic window analysis evaluating measurement evidence against threshold rules.
- Diagnosis: built (candidate rules implemented; no AI service, no RAG).
- Repair guide: backend data model and lookup built; no mobile screen, no speech output.
- Verification decision: pure logic built against baseline; no database storage, no mobile screen.

## 6. Decisions Made

- Plain SQL migrations with pg driver and no ORM: keeps the schema explicit and lightweight, avoiding ORM overhead when raw SQL is needed for vector queries later.
- Embedded PostgreSQL started by test runner: tests run autonomously without requiring an external database installation or preconfigured credentials.
- In-process Aedes MQTT broker for testing and demonstration: avoids external broker infrastructure while allowing drop-in connection to external brokers via URL configuration.
- Explicit source labeling: readings are tagged as simulated or sensor to ensure synthetic data is never mistaken for physical hardware readings.
- Placeholder simulator thresholds: defined solely to make simulated fault scenarios statistically distinguishable, not as calibrated engineering limits.
- Single-branch trunk workflow: development proceeds directly on main with focused commits, avoiding merge overhead.
- Anomaly detection runs in the Node backend as a pure module for now, and it may move to the AI service later behind the same function contract: keeps the first analysis step testable without a second service.
- Diagnosis uses fixed candidate rules, not a language model, and presents every candidate as a possibility with a check to run: the system must not claim certainty it does not have.
- The repair guide returns only approved, source-referenced steps and never generates instructions, because unverified repair steps are unsafe.
- Repair verification uses the baseline and the same detection rules, so PASS means no fault signature relative to the reference, not proof of repair.

## 7. Known Issues

- The repair procedures table is empty until a human approves real procedures from source documents.
- MIN_BASELINE_READINGS and MIN_POST_REPAIR_READINGS are placeholder values until calibration.
- The anomaly detector's default 20-reading window reaches only part of full fault magnitude on the simulator, so detection margins are thin; and simulated data cannot support real machine decisions.
- embedded-postgres is pinned to beta version 18.4.0-beta.17. Stability should be rechecked before the final demonstration.
- Live delivery queries the latest row after each stored reading; two closely spaced readings could cause a client to receive a duplicate reading or miss an intermediate update.
- pgvector is not available in the embedded PostgreSQL package, requiring an alternative environment or service for vector embeddings during RAG implementation.
- The httpx library produces a deprecation warning in pytest with FastAPI testclient. It does not cause test failure.
- No hardware, firmware, or mobile client code is implemented yet.

## 8. How to Run and Test

Backend tests:
```powershell
npm test
```
Run from backend/.

Backend server start:
```powershell
npm start
```
Run from backend/. Configuration options are defined in .env.example.

AI service tests:
```powershell
.\.venv\Scripts\python.exe -m pytest -v
```
Run from ai-service/ after virtual environment creation as documented in ai-service/README.md.

## 9. Next Steps

1. Commit the repair verification decision module once approved.
2. Build maintenance report generation or verification storage, as the owner decides.
3. Develop the mobile application starting with the Live Monitor screen, followed by Diagnosis, Repair Guide, and Verification views.
4. ESP32 sensor hardware integration.

## 10. Update Rule

When a development step is completed, add one row to the Completed Work table with date, short commit hash, and summary. Update the current status description and test counts. Move items from Work in Progress to Completed Work once committed.
