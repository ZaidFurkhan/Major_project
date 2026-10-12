import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { createTelemetryBroadcaster } from '../../src/realtime/telemetryBroadcaster.js';

async function waitForCondition(predicate, timeoutMs = 5000, desc = 'condition') {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${desc}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function collectMessages(ws) {
  const messages = [];
  ws.on('message', (data) => {
    try {
      messages.push(JSON.parse(data.toString()));
    } catch {
      messages.push(data.toString());
    }
  });
  return messages;
}

describe('telemetryBroadcaster', () => {
  let httpServer;
  let broadcaster;
  let port;

  before(async () => {
    httpServer = http.createServer();
    broadcaster = createTelemetryBroadcaster();
    broadcaster.attach(httpServer, '/ws/telemetry');

    await new Promise((resolve, reject) => {
      httpServer.listen(0, '127.0.0.1', resolve);
      httpServer.on('error', reject);
    });

    port = httpServer.address().port;
  });

  after(async () => {
    if (broadcaster) {
      await broadcaster.close();
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  it('delivers hello on connect, broadcasts stored readings, ignores non-stored, and isolates other paths', async () => {
    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws/telemetry`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws/telemetry`);

    const msgs1 = collectMessages(ws1);
    const msgs2 = collectMessages(ws2);

    try {
      // 1. Each client receives a hello message first
      await waitForCondition(
        () => msgs1.length >= 1 && msgs2.length >= 1,
        5000,
        'hello message on connected clients'
      );

      assert.equal(msgs1[0].type, 'hello');
      assert.ok(typeof msgs1[0].serverTime === 'string');
      assert.equal(msgs2[0].type, 'hello');
      assert.ok(typeof msgs2[0].serverTime === 'string');

      // 2. clientCount() reflects connected clients
      assert.equal(broadcaster.clientCount(), 2);

      // 3. publish({ status: 'stored', ... }) reaches both clients
      const sampleReading = {
        machineId: '00000000-0000-0000-0000-000000000001',
        timestamp: '2026-03-01T12:00:00.000Z',
        temperatureC: 45.2,
      };

      broadcaster.publish({ status: 'stored', id: '1', reading: sampleReading });

      await waitForCondition(
        () => msgs1.length >= 2 && msgs2.length >= 2,
        5000,
        'stored telemetry message'
      );

      assert.equal(msgs1[1].type, 'telemetry');
      assert.deepEqual(msgs1[1].reading, { ...sampleReading, id: '1' });
      assert.equal(msgs2[1].type, 'telemetry');
      assert.deepEqual(msgs2[1].reading, { ...sampleReading, id: '1' });

      // 4. publish rejected and duplicate sends nothing
      broadcaster.publish({ status: 'rejected', errors: ['invalid temperature'] });
      broadcaster.publish({ status: 'duplicate' });

      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(msgs1.length, 2);
      assert.equal(msgs2.length, 2);

      // 5. Connection to a different path is refused or does not receive telemetry
      let otherRefused = false;
      const wsOther = new WebSocket(`ws://127.0.0.1:${port}/ws/other`);
      wsOther.on('error', () => {
        otherRefused = true;
      });
      const msgsOther = collectMessages(wsOther);

      await new Promise((resolve) => setTimeout(resolve, 150));

      broadcaster.publish({
        status: 'stored',
        id: '2',
        reading: { ...sampleReading, temperatureC: 46.0 },
      });

      await waitForCondition(() => msgs1.length >= 3, 5000, 'third message on ws1');
      assert.equal(msgsOther.length, 0);
      assert.ok(otherRefused || wsOther.readyState !== WebSocket.OPEN);

      try {
        wsOther.terminate();
      } catch {
        // Ignore
      }
    } finally {
      try {
        ws1.terminate();
        ws2.terminate();
      } catch {
        // Ignore
      }
    }
  });

  it('close() resolves and closes all clients', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/telemetry`);
    await waitForCondition(() => ws.readyState === WebSocket.OPEN, 5000, 'ws open');

    assert.equal(broadcaster.clientCount(), 1);
    await broadcaster.close();
    assert.equal(broadcaster.clientCount(), 0);

    await waitForCondition(
      () => ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING,
      5000,
      'ws closed after broadcaster.close()'
    );
  });
});
