import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Aedes } from 'aedes';
import EmbeddedPostgres from 'embedded-postgres';
import { connectAsync } from 'mqtt';
import { createMachine, listMachines } from '../src/db/machines.js';
import { runMigrations } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { createSimulator } from '../src/simulator/simulator.js';
import { SCENARIOS, validateReading } from '../src/telemetry/contract.js';

let pg;
let broker;
let brokerServer;
let mqttClient;
let publishInterval;
let shuttingDown = false;

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (publishInterval) {
    clearInterval(publishInterval);
  }

  if (mqttClient) {
    try {
      await mqttClient.endAsync();
    } catch {
      // Ignore MQTT client close error on shutdown
    }
  }

  if (broker) {
    try {
      await new Promise((resolve) => broker.close(resolve));
    } catch {
      // Ignore broker close error on shutdown
    }
  }

  if (brokerServer) {
    try {
      await new Promise((resolve) => brokerServer.close(resolve));
    } catch {
      // Ignore server close error on shutdown
    }
  }

  if (pg) {
    try {
      await pg.stop();
    } catch {
      // Ignore postgres stop error on shutdown
    }
  }

  process.exit(0);
}

process.on('SIGINT', async () => {
  await shutdown();
});

process.on('SIGTERM', async () => {
  await shutdown();
});

process.stdin.on('data', async (chunk) => {
  if (chunk.includes(3)) {
    await shutdown();
  }
});
process.stdin.resume();

async function main() {
  const password = process.env.MECHSENSE_DEV_DB_PASSWORD;
  if (!password || password.trim() === '') {
    console.error('Set MECHSENSE_DEV_DB_PASSWORD before running this script.');
    process.exit(1);
  }

  const rawScenario = process.env.MECHSENSE_DEV_SCENARIO;
  const scenario = rawScenario && rawScenario.trim() !== '' ? rawScenario.trim() : 'normal';
  if (!SCENARIOS.includes(scenario)) {
    console.error(`Invalid scenario: "${scenario}". Allowed values: ${SCENARIOS.join(', ')}`);
    process.exit(1);
  }

  const dataDir = path.join(os.homedir(), 'mechsense-dev-db');
  await fs.mkdir(dataDir, { recursive: true });

  const portFilePath = path.join(dataDir, 'port.txt');
  let dbPort;
  let portFileExists = false;
  try {
    const existing = await fs.readFile(portFilePath, 'utf-8');
    const parsed = Number.parseInt(existing.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
      dbPort = parsed;
      portFileExists = true;
    }
  } catch {
    // port.txt does not exist yet or could not be read
  }

  if (!dbPort) {
    dbPort = await findFreePort();
  }

  const pgVersionFile = path.join(dataDir, 'PG_VERSION');
  let isInitialized = false;
  try {
    await fs.access(pgVersionFile);
    isInitialized = true;
  } catch {
    isInitialized = false;
  }

  if (!isInitialized && portFileExists) {
    await fs.unlink(portFilePath).catch(() => {});
  }

  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password,
    port: dbPort,
    persistent: true,
  });

  if (!isInitialized) {
    await pg.initialise();
    await fs.writeFile(portFilePath, dbPort.toString(), 'utf-8');
  } else if (!portFileExists) {
    await fs.writeFile(portFilePath, dbPort.toString(), 'utf-8');
  }

  await pg.start();

  const adminClient = pg.getPgClient('postgres', '127.0.0.1');
  await adminClient.connect();
  try {
    const checkDb = await adminClient.query(
      'select 1 from pg_database where datname = $1;',
      ['mechsense_dev']
    );
    if (checkDb.rows.length === 0) {
      await adminClient.query('create database mechsense_dev;');
    }
  } finally {
    await adminClient.end();
  }

  const databaseUrl = `postgres://postgres:${password}@127.0.0.1:${dbPort}/mechsense_dev`;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  let migrationsDir = path.resolve(scriptDir, '../database/migrations');
  try {
    await fs.access(migrationsDir);
  } catch {
    migrationsDir = path.resolve(scriptDir, '../../database/migrations');
  }

  let machineId;
  const pool = createPool(databaseUrl);
  try {
    await runMigrations(pool, migrationsDir);

    const existingMachines = await listMachines(pool);
    let rigMachine = existingMachines.find((m) => m.name === 'Motor Test Rig');
    if (!rigMachine) {
      rigMachine = await createMachine(pool, {
        name: 'Motor Test Rig',
        type: 'motor-rig',
        location: 'Local Test Rig',
      });
    }
    machineId = rigMachine.id;
  } finally {
    await pool.end();
  }

  broker = await Aedes.createBroker();
  brokerServer = net.createServer(broker.handle);
  let brokerPort = 1883;

  await new Promise((resolve, reject) => {
    brokerServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        brokerServer.close();
        brokerServer = net.createServer(broker.handle);
        brokerServer.listen(0, '127.0.0.1', () => {
          brokerPort = brokerServer.address().port;
          resolve();
        });
        brokerServer.once('error', reject);
      } else {
        reject(err);
      }
    });

    brokerServer.listen(1883, '127.0.0.1', () => {
      brokerPort = brokerServer.address().port;
      resolve();
    });
  });

  console.log(`Broker port: ${brokerPort}`);

  const brokerUrl = `mqtt://127.0.0.1:${brokerPort}`;
  mqttClient = await connectAsync(brokerUrl);

  const startTime = new Date().toISOString();
  const simulator = createSimulator({
    machineId,
    scenario,
    seed: 1,
    startTime,
  });

  const topic = `mechsense/${machineId}/telemetry`;
  publishInterval = setInterval(async () => {
    try {
      const reading = simulator.next();
      const validation = validateReading(reading);
      if (!validation.valid) {
        return;
      }
      await mqttClient.publishAsync(topic, JSON.stringify(validation.value), { qos: 1 });
    } catch (err) {
      if (!shuttingDown) {
        console.error('Publish error:', err.message);
      }
    }
  }, 1000);

  console.log('--------------------------------------------------');
  console.log('MechSense Development Stack');
  console.log(`Machine ID:    ${machineId}`);
  console.log(`Scenario:      ${scenario}`);
  console.log(`Broker URL:    ${brokerUrl}`);
  console.log(`Database Port: ${dbPort}`);
  console.log('Set MQTT_URL to the broker URL and DATABASE_URL in the backend window, then start the backend.');
  console.log('--------------------------------------------------');
}

main().catch(async (err) => {
  console.error('Error starting development stack:', err);
  if (pg) {
    try {
      await pg.stop();
    } catch {
      // Ignore postgres stop error on fatal failure
    }
  }
  process.exit(1);
});
