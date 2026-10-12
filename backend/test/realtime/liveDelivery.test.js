import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { Aedes } from 'aedes';
import { connectAsync } from 'mqtt';
import WebSocket from 'ws';
import { openTestPool } from '../helpers/testDb.js';
import { createApp } from '../../src/app.js';
import { createMachine } from '../../src/db/machines.js';
import { getLatestTelemetryReading } from '../../src/db/telemetryReadings.js';
import { createTelemetryBroadcaster } from '../../src/realtime/telemetryBroadcaster.js';
import { startMqttIngestion } from '../../src/ingestion/mqttIngestion.js';
import { createSimulator } from '../../src/simulator/simulator.js';
import { validateReading } from '../../src/telemetry/contract.js';

async function waitForCondition(predicate, timeoutMs = 5000, desc = 'condition') {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${desc}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('live telemetry delivery end-to-end', () => {
  it('delivers MQTT-ingested readings over WebSocket and exposes them via REST', async () => {
    let pool;
    let broker;
    let netServer;
    let httpServer;
    let broadcaster;
    let ingestion;
    let publisher;
    let wsClient;

    try {
      pool = await openTestPool();
      await pool.query('TRUNCATE telemetry_readings RESTART IDENTITY;');

      // 1. Start in-process Aedes broker
      broker = await Aedes.createBroker();
      netServer = createNetServer(broker.handle);
      await new Promise((resolve, reject) => {
        netServer.listen(0, '127.0.0.1', resolve);
        netServer.on('error', reject);
      });
      const mqttPort = netServer.address().port;
      const brokerUrl = `mqtt://127.0.0.1:${mqttPort}`;

      // 2. Start HTTP server with app and broadcaster attached
      const app = createApp({ pool });
      httpServer = http.createServer(app);
      broadcaster = createTelemetryBroadcaster();
      broadcaster.attach(httpServer, '/ws/telemetry');

      await new Promise((resolve, reject) => {
        httpServer.listen(0, '127.0.0.1', resolve);
        httpServer.on('error', reject);
      });
      const httpPort = httpServer.address().port;

      // 3. Start MQTT ingestion with onResult broadcasting latest stored reading
      ingestion = await startMqttIngestion({
        brokerUrl,
        pool,
        topic: 'mechsense/+/telemetry',
        onResult: async (result, topicString) => {
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
        },
      });

      // 4. Connect WebSocket client, wait for hello
      wsClient = new WebSocket(`ws://127.0.0.1:${httpPort}/ws/telemetry`);
      const wsMessages = [];
      wsClient.on('message', (data) => {
        try {
          wsMessages.push(JSON.parse(data.toString()));
        } catch {
          wsMessages.push(data.toString());
        }
      });

      await waitForCondition(
        () => wsMessages.length >= 1 && wsMessages[0].type === 'hello',
        5000,
        'WebSocket hello message'
      );

      // 5. Create machine and publish valid simulated reading with QoS 1
      const machine = await createMachine(pool, {
        name: 'Live E2E Motor',
        type: 'synchronous',
      });

      const simulator = createSimulator({
        machineId: machine.id,
        scenario: 'normal',
        seed: 77,
        startTime: '2026-04-01T08:00:00.000Z',
      });
      const rawReading = simulator.next();
      const validated = validateReading(rawReading);
      assert.equal(validated.valid, true);

      publisher = await connectAsync(brokerUrl);
      const topic = `mechsense/${machine.id}/telemetry`;
      await publisher.publishAsync(topic, JSON.stringify(validated.value), { qos: 1 });

      // 6. Assert WebSocket client receives telemetry with matching machineId and timestamp
      await waitForCondition(
        () => wsMessages.length >= 2,
        5000,
        'telemetry message on WebSocket client'
      );

      assert.equal(wsMessages[1].type, 'telemetry');
      assert.ok(wsMessages[1].reading !== undefined);
      assert.equal(wsMessages[1].reading.machineId, machine.id);
      assert.equal(wsMessages[1].reading.timestamp, validated.value.timestamp);

      // 7. Assert GET /api/telemetry/<machineId>/latest returns the same timestamp
      const res = await fetch(`http://127.0.0.1:${httpPort}/api/telemetry/${machine.id}/latest`);
      assert.equal(res.status, 200);
      const restBody = await res.json();
      assert.equal(restBody.reading.timestamp, validated.value.timestamp);
      assert.equal(restBody.reading.machineId, machine.id);
    } finally {
      if (wsClient) {
        try {
          wsClient.terminate();
        } catch {
          // Ignore
        }
      }
      if (publisher) {
        try {
          await publisher.endAsync();
        } catch {
          // Ignore
        }
      }
      if (ingestion) {
        try {
          await ingestion.stop();
        } catch {
          // Ignore
        }
      }
      if (broadcaster) {
        try {
          await broadcaster.close();
        } catch {
          // Ignore
        }
      }
      if (httpServer) {
        try {
          await new Promise((resolve) => httpServer.close(resolve));
        } catch {
          // Ignore
        }
      }
      if (broker) {
        try {
          await new Promise((resolve) => broker.close(resolve));
        } catch {
          // Ignore
        }
      }
      if (netServer) {
        try {
          await new Promise((resolve) => netServer.close(resolve));
        } catch {
          // Ignore
        }
      }
      if (pool) {
        try {
          await pool.end();
        } catch {
          // Ignore
        }
      }
    }
  });
});
