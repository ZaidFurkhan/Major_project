# MechSense

AI-assisted predictive-maintenance and fault diagnosis for a motor test rig. Monitors temperature, vibration, current, and RPM; detects abnormal behavior; supports diagnosis, guided repair, and verification.

## Repository layout
- mobile/: React Native (JavaScript) application
- backend/: Node.js and Express API, MQTT ingestion, WebSocket broadcast
- ai-service/: Python and FastAPI for sensor analysis, diagnosis, vision, and RAG
- firmware/: ESP32 sensor firmware
- database/: PostgreSQL schema and migrations
- docs/: project documentation

Status: see the Current status section below.

## Current status
The project is in active development and not yet runnable as a complete system.
Backend capabilities: health endpoint, PostgreSQL schema and migrations, MQTT telemetry ingestion, WebSocket live delivery, and latest-reading REST endpoint.
AI service: health endpoint only.
See docs/PROGRESS.md for the full status and next steps.

Note: Simulated telemetry and real sensor data must always be distinguishable.
