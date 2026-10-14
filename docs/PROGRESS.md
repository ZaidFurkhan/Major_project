# MechSense Project Progress

## 1. Project Summary

MechSense is an AI-assisted predictive-maintenance and fault diagnosis system for an electric motor test rig. It monitors operating channels including temperature, vibration, current, and rotational speed to detect abnormal conditions. The system guides operators through fault isolation, recommended repairs, and post-repair verification to ensure operational reliability.

## 2. Current Status

As of October 14, 2026, the repository contains 26 commits on main, 104 passing backend tests across 15 suites, and 2 passing AI service tests. The core backend pipeline for telemetry simulation, database persistence, MQTT ingestion, WebSocket live broadcast, latest-reading REST query, deterministic anomaly detection, candidate-cause diagnosis, and approved repair procedure storage and lookup is implemented, while AI service integrations, repair verification workflows, and mobile interfaces remain in early scaffolding.

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

## 4. Work in Progress (Not Yet Committed)

The approved repair procedure storage and lookup feature is implemented in the local working tree and planned for commit. It adds 16 tests, raising the backend test total from 88 to 104 across 15 suites:

- database/migrations/0003_approved_procedures.sql: SQL migration adding repair_procedures and repair_steps tables with constraints (uncommitted).
- backend/src/db/repairProcedures.js: Database repository functions for creating, approving, and querying repair procedures and steps (uncommitted).
- backend/src/repair/guide.js: Domain module providing validated repair guide lookups for allowed fault signatures (uncommitted).
- backend/src/api/repairGuide.routes.js: Express router exposing the approved repair guide GET endpoint (uncommitted).
- backend/src/app.js: Mounts the repair guide router in the application when a database pool is provided (uncommitted).
- backend/test/repair/repairProcedures.test.js: Unit tests for repair procedure repository operations, constraints, and cascading deletes (8 tests, uncommitted).
- backend/test/repair/guide.test.js: Unit tests for repair guide domain lookup rules and fixture retrieval (4 tests, uncommitted).
- backend/test/api/repairGuideRoutes.test.js: Integration tests for the repair guide REST endpoint and health check (4 tests, uncommitted).

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

## 7. Known Issues

- The repair procedures table is empty until a human approves real procedures from source documents.
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

1. Commit the approved repair procedure storage and lookup once approved.
2. Build the repair verification logic evaluating post-repair telemetry to return PASS, FAIL, or INCONCLUSIVE.
3. Develop the mobile application starting with the Live Monitor screen, followed by Diagnosis, Repair Guide, and Verification views.
4. Build maintenance report generation, followed by ESP32 sensor hardware integration.

## 10. Update Rule

When a development step is completed, add one row to the Completed Work table with date, short commit hash, and summary. Update the current status description and test counts. Move items from Work in Progress to Completed Work once committed.
