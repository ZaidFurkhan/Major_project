import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Aedes } from 'aedes';
import { connectAsync } from 'mqtt';
import { openTestPool } from '../helpers/testDb.js';
import { createMachine } from '../../src/db/machines.js';
import { getLatestTelemetryReading } from '../../src/db/telemetryReadings.js';
import {
  parseTelemetryMessage,
  handleTelemetryMessage,
  startMqttIngestion,
} from '../../src/ingestion/mqttIngestion.js';

async function waitForResults(collector, expectedCount, timeoutMs = 5000) {
  const start = Date.now();
  while (collector.length < expectedCount) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${expectedCount} results (collected: ${collector.length})`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('MQTT ingestion', () => {
  let pool;
  let broker;
  let server;
  let brokerUrl;

  before(async () => {
    pool = await openTestPool();

    broker = await Aedes.createBroker();
    server = createServer(broker.handle);

    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });

    const port = server.address().port;
    brokerUrl = `mqtt://127.0.0.1:${port}`;
  });

  after(async () => {
    if (broker) {
      await new Promise((resolve) => broker.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE telemetry_readings RESTART IDENTITY;');
  });

  it('parses valid and invalid JSON payloads without throwing', () => {
    const validString = parseTelemetryMessage('{"temperatureC": 45}');
    assert.equal(validString.valid, true);
    assert.equal(validString.reading.temperatureC, 45);

    const validBuffer = parseTelemetryMessage(Buffer.from('{"rpm": 1500}'));
    assert.equal(validBuffer.valid, true);
    assert.equal(validBuffer.reading.rpm, 1500);

    const invalidJson = parseTelemetryMessage('{bad-json}');
    assert.equal(invalidJson.valid, false);
    assert.ok(invalidJson.errors.length > 0);

    const nullPayload = parseTelemetryMessage(null);
    assert.equal(nullPayload.valid, false);
  });

  it('rejects invalid machineId UUID format before querying the database', async () => {
    const invalidReadingPayload = Buffer.from(
      JSON.stringify({
        machineId: 'not-a-uuid-string',
        timestamp: '2026-03-01T10:00:00.000Z',
        source: 'simulated',
        scenario: 'normal',
        temperatureC: 45,
        vibrationRmsG: 0.5,
        currentA: 5.0,
        rpm: 1500,
        commandedRpm: 1500,
      })
    );

    const result = await handleTelemetryMessage(pool, invalidReadingPayload);
    assert.equal(result.status, 'rejected');
    assert.ok(result.errors.some((e) => e.includes('UUID')));
  });

  it('receives readings over MQTT, stores valid, rejects invalid, ignores duplicates', async () => {
    const machine = await createMachine(pool, {
      name: 'Ingestion Test Motor',
      type: 'squirrel-cage',
      location: 'Test Bay 1',
    });

    const results = [];
    const ingestion = await startMqttIngestion({
      brokerUrl,
      pool,
      topic: 'mechsense/+/telemetry',
      onResult: (result, topic) => {
        results.push({ result, topic });
      },
    });

    const publisher = await connectAsync(brokerUrl);

    try {
      const topic = `mechsense/${machine.id}/telemetry`;

      const reading1 = {
        machineId: machine.id,
        timestamp: '2026-03-01T10:00:00.000Z',
        source: 'simulated',
        scenario: 'normal',
        temperatureC: 45.0,
        vibrationRmsG: 0.5,
        currentA: 5.0,
        rpm: 1500,
        commandedRpm: 1500,
        dataQuality: { windowSamples: 100, dropoutCount: 0 },
      };

      const reading2 = {
        machineId: machine.id,
        timestamp: '2026-03-01T10:00:01.000Z',
        source: 'simulated',
        scenario: 'normal',
        temperatureC: 45.5,
        vibrationRmsG: 0.52,
        currentA: 5.1,
        rpm: 1498,
        commandedRpm: 1500,
        dataQuality: { windowSamples: 100, dropoutCount: 0 },
      };

      const reading3 = {
        machineId: machine.id,
        timestamp: '2026-03-01T10:00:02.000Z',
        source: 'simulated',
        scenario: 'vibration_anomaly',
        temperatureC: 46.0,
        vibrationRmsG: 2.4,
        currentA: 5.2,
        rpm: 1502,
        commandedRpm: 1500,
        dataQuality: { windowSamples: 100, dropoutCount: 1 },
      };

      // 1. Publish three valid readings with QoS 1
      await publisher.publishAsync(topic, JSON.stringify(reading1), { qos: 1 });
      await publisher.publishAsync(topic, JSON.stringify(reading2), { qos: 1 });
      await publisher.publishAsync(topic, JSON.stringify(reading3), { qos: 1 });

      await waitForResults(results, 3);
      assert.equal(results[0].result.status, 'stored');
      assert.ok(results[0].result.id !== undefined);
      assert.equal(results[1].result.status, 'stored');
      assert.ok(results[1].result.id !== undefined);
      assert.equal(results[2].result.status, 'stored');
      assert.ok(results[2].result.id !== undefined);

      // 2. Publish invalid JSON payload and payload with temperatureC 999
      await publisher.publishAsync(topic, 'INVALID_NOT_JSON', { qos: 1 });
      await waitForResults(results, 4);
      assert.equal(results[3].result.status, 'rejected');

      const outOfRangeReading = { ...reading1, timestamp: '2026-03-01T10:00:03.000Z', temperatureC: 999 };
      await publisher.publishAsync(topic, JSON.stringify(outOfRangeReading), { qos: 1 });
      await waitForResults(results, 5);
      assert.equal(results[4].result.status, 'rejected');

      // 3. Publish valid reading to topic whose machine segment does not match payload machineId
      const mismatchedTopic = 'mechsense/00000000-0000-0000-0000-000000000001/telemetry';
      const mismatchReading = { ...reading1, timestamp: '2026-03-01T10:00:04.000Z' };
      await publisher.publishAsync(mismatchedTopic, JSON.stringify(mismatchReading), { qos: 1 });
      await waitForResults(results, 6);
      assert.equal(results[5].result.status, 'rejected');
      assert.deepEqual(results[5].result.errors, ['topic machine segment does not match payload machineId']);

      // 4. Publish valid reading for a UUID machine that does not exist in the database
      const nonExistentMachineId = '00000000-0000-0000-0000-000000000002';
      const nonExistentTopic = `mechsense/${nonExistentMachineId}/telemetry`;
      const nonExistentReading = { ...reading1, machineId: nonExistentMachineId, timestamp: '2026-03-01T10:00:05.000Z' };
      await publisher.publishAsync(nonExistentTopic, JSON.stringify(nonExistentReading), { qos: 1 });
      await waitForResults(results, 7);
      assert.equal(results[6].result.status, 'rejected');

      // 5. Publish the first valid reading again (same machineId, source, recorded_at)
      await publisher.publishAsync(topic, JSON.stringify(reading1), { qos: 1 });
      await waitForResults(results, 8);
      assert.equal(results[7].result.status, 'duplicate');

      // 6. Confirm getLatestTelemetryReading returns the newest stored reading
      const latest = await getLatestTelemetryReading(pool, machine.id);
      assert.ok(latest !== null);
      assert.equal(latest.timestamp, '2026-03-01T10:00:02.000Z');
      assert.equal(latest.scenario, 'vibration_anomaly');
      assert.equal(latest.vibrationRmsG, 2.4);
      assert.equal(latest.temperatureC, 46.0);
    } finally {
      if (publisher) {
        await publisher.endAsync();
      }
      if (ingestion) {
        await ingestion.stop();
      }
    }
  });
});
