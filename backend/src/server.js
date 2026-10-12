import http from 'node:http';
import { createApp } from './app.js';
import { createPool } from './db/pool.js';
import { createTelemetryBroadcaster } from './realtime/telemetryBroadcaster.js';
import { startMqttIngestion } from './ingestion/mqttIngestion.js';
import { getLatestTelemetryReading } from './db/telemetryReadings.js';

const rawPort = process.env.PORT;
let port = 3000;
if (rawPort !== undefined && rawPort.trim() !== '') {
  const num = Number(rawPort);
  if (Number.isInteger(num) && num > 0) {
    port = num;
  }
}

let pool = null;
if (process.env.DATABASE_URL) {
  try {
    pool = createPool(process.env.DATABASE_URL);
  } catch (err) {
    console.error('Failed to create database pool:', err.name);
  }
} else {
  console.log('database is not configured');
}

const app = createApp({ pool });
const server = http.createServer(app);

const broadcaster = createTelemetryBroadcaster();
broadcaster.attach(server, '/ws/telemetry');

if (process.env.MQTT_URL && pool) {
  startMqttIngestion({
    brokerUrl: process.env.MQTT_URL,
    pool,
    onResult: async (result, topicString) => {
      try {
        if (result && result.status === 'stored') {
          const segments = typeof topicString === 'string' ? topicString.split('/') : [];
          const machineId = segments[1];
          if (machineId) {
            const reading = await getLatestTelemetryReading(pool, machineId);
            if (reading) {
              broadcaster.publish({ status: 'stored', id: result.id, reading });
              return;
            }
          }
        }
        broadcaster.publish(result);
      } catch (err) {
        console.error('Error in telemetry broadcasting:', err.name);
      }
    },
  }).catch((err) => {
    console.error('Failed to start MQTT ingestion:', err.name);
  });
}

server.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
