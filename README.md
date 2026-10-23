# MechSense

MechSense is a predictive-maintenance system for an industrial electric motor test rig. It monitors telemetry readings, detects abnormal operating patterns, suggests candidate causes with verification checks, displays approved repair procedures, verifies outcomes against a baseline, and maintains records for each service case.

## Status

MechSense is a software MVP validated on simulated data only. Hardware integration and real-motor testing on the physical test rig are the next step. Real sensors, physical hardware, real-motor testing, calibration, the knowledge base, RAG (retrieval-augmented generation), and automatic case promotion are not built.

## Features

### Sensing and data
- Receives telemetry over MQTT and validates every reading against a fixed contract.
- Stores readings in PostgreSQL.
- Pushes new readings to connected clients over WebSocket.
- Serves the latest reading over a REST endpoint, with a freshness flag.
- Labels every reading as `simulated` or `sensor`. The two are never mixed.

### Analysis
- Detects four fault signatures: vibration rise, overheating, abnormal load, and speed deviation.
- Produces candidate causes with supporting evidence and checks to run, never reporting a confirmed cause.

### Repair and verification
- Stores approved repair procedures with source references. The repair guide shows only approved steps; currently none are approved, so it shows "no approved procedure".
- Compares post-repair readings against a baseline and returns PASS, FAIL, or INCONCLUSIVE.
- A repair is reported as verified only on a PASS result.
- Stores verification results and diagnoses against service cases. Neither changes a case's status; closing a case is a separate decision.

### Reporting
- Builds a case report in JSON or plain text from stored case, verification, and diagnosis records.
- A repair is reported as verified only on a PASS result.

### Mobile app
The phone does no diagnosis or repair logic and stores nothing.
- Welcome: starts the application and checks backend connectivity.
- Live Monitor: shows temperature, vibration, current, and speed, with simulated data labeling and stale-data warnings.
- Diagnosis: shows candidate causes with supporting evidence and checks to run.
- Repair guide: shows approved, source-referenced repair steps for each fault signature (currently shows "no approved procedure").
- Verification: shows post-repair verification results and uncertainty statements.
- Report: shows case details, verified repair outcome, and diagnostic notes.

## Not yet built

The following components and capabilities are not built:
- Real sensors and ESP32 firmware
- Real-motor calibration
- Knowledge base
- Retrieval-augmented generation (RAG)
- Automatic promotion of verified cases

## Repository layout

- mobile/: React Native (Expo) mobile application
- backend/: Node.js and Express API, MQTT ingestion, WebSocket broadcast, anomaly detection, and verification
- ai-service/: Python and FastAPI service scaffolding and health endpoint
- database/: PostgreSQL schema and migrations
- firmware/: ESP32 sensor firmware (scaffolding)
- docs/: project documentation and progress records

## Getting started

Run all commands in PowerShell.

### Backend tests
Run tests without needing a system database:
```powershell
cd backend
npm test
```

### Local development stack
Set `$env:MECHSENSE_DEV_DB_PASSWORD` to a local value you choose, then start the stack:
```powershell
cd backend
$env:MECHSENSE_DEV_DB_PASSWORD = "<choose-password>"
npm run dev:stack
```
You must choose the password yourself and must not commit it. Leave this terminal running; it prints the database connection string and MQTT broker URL.

### Demo case
In a new PowerShell window, seed a demo case using the database connection string printed by the stack:
```powershell
cd backend
$env:DATABASE_URL = "<value-printed-by-stack>"
npm run db:seed-demo
```

### Backend server
In a new PowerShell window, set the database and MQTT URLs printed by the stack, then start the server:
```powershell
cd backend
$env:DATABASE_URL = "<value-printed-by-stack>"
$env:MQTT_URL = "<value-printed-by-stack>"
npm start
```

### Mobile app
Configure mobile settings locally before starting:
- The backend address goes in `mobile/src/config.js`.
- The case ID goes in `mobile/src/monitorSettings.js`.
- Both stay local and are never committed.

Start the mobile app with Expo:
```powershell
cd mobile
npx expo start -c
```
Scan the QR code with Expo Go on an Android device connected to the same Wi-Fi network.

## Troubleshooting

- **"Cannot reach backend"**: The phone and PC are not on the same network, or the backend address configured in `mobile/src/config.js` is wrong.
- **Windows Firewall**: Port 8081 (Expo) and port 3000 (backend) may need to be allowed in Windows Firewall.
- **Network profile**: The network profile on the host PC must be set to Private.

## Limitations

- **Simulated data only**: Validated exclusively on simulated data; no accuracy, detection rates, or real-world performance are claimed.
- **Placeholder thresholds**: Detection and baseline thresholds are placeholders and have not been calibrated on a physical motor.
- **Four fault signatures only**: Detection is limited to vibration rise, overheating, abnormal load, and speed deviation.
- **Verification meaning**: A PASS means the four fault signatures are absent relative to the baseline, not that the root cause was repaired.
- **Repair guidance empty**: The repair guide remains empty ("no approved procedure") until a person approves procedures from source documentation.

## Licence

To be confirmed.
