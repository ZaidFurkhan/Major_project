# MechSense

MechSense is an AI-assisted predictive maintenance system for an industrial motor test rig. It monitors motor sensor readings, detects known fault patterns, suggests possible causes with checks to run, guides the repair using approved procedures only, verifies the result with new measurements, and records each case.

## Status

The project is in active development.

- **Backend:** built and tested on simulated data.
- **Mobile app:** welcome screen and live monitor screen run on Android through Expo Go.
- **AI service:** health endpoint only.
- **Hardware:** not yet integrated. All current results come from simulated readings.

## Features

**Sensing and data**
- Receives telemetry over MQTT and validates every reading against a fixed contract.
- Stores readings in PostgreSQL.
- Pushes new readings to connected clients over WebSocket.
- Serves the latest reading over a REST endpoint, with a freshness flag.
- Labels every reading as `simulated` or `sensor`. The two are never mixed.

**Analysis**
- Detects four fault signatures: vibration rise, overheating, abnormal load, and speed deviation.
- Produces candidate causes with supporting evidence and checks to run. It never reports a confirmed cause.

**Repair and verification**
- Stores approved repair procedures with source references. Steps are returned only when an approved procedure exists.
- Compares post-repair readings against a baseline and returns PASS, FAIL, or INCONCLUSIVE.
- Stores verification results and diagnoses against service cases. Neither changes a case's status. Closing a case is a separate decision.

**Reporting**
- Builds a case report in JSON or plain text.
- A repair is reported as verified only when the latest verification is PASS.

**Mobile app (Expo, React Native)**
- Welcome screen, then a live monitor showing temperature, vibration, current, and speed.
- Clearly labels simulated data and shows a stale-data warning.
