# MechSense

AI-assisted predictive-maintenance and fault diagnosis for a motor test rig. Monitors temperature, vibration, current, and RPM; detects abnormal behavior; supports diagnosis, guided repair, and verification.

## Repository layout
- mobile/: React Native (JavaScript) application
- backend/: Node.js and Express API, MQTT ingestion, WebSocket broadcast
- ai-service/: Python and FastAPI for sensor analysis, diagnosis, vision, and RAG
- firmware/: ESP32 sensor firmware
- database/: PostgreSQL schema and migrations
- docs/: project documentation

Status: Scaffolding only. No components are runnable yet.

Note: Simulated telemetry and real sensor data must always be distinguishable.
