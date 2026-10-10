import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';

async function main() {
  if (process.env.TEST_DATABASE_READY === '1' || process.execArgv.some((arg) => arg.startsWith('--test'))) {
    return;
  }

  let pg;
  let tempDir;
  let exitCode = 1;

  try {
    const freePort = await new Promise((resolve, reject) => {
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

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-embedded-'));

    const password = crypto.randomBytes(16).toString('hex');

    pg = new EmbeddedPostgres({
      databaseDir: tempDir,
      user: 'postgres',
      password: password,
      port: freePort,
      persistent: false,
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase('mechsense_test');

    const databaseUrl = `postgres://postgres:${password}@127.0.0.1:${freePort}/mechsense_test`;
    const childEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_READY: '1',
    };

    exitCode = await new Promise((resolve) => {
      const child = spawn('node', ['--test', '--test-concurrency=1'], {
        env: childEnv,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        resolve(code !== null ? code : 1);
      });

      child.on('error', (err) => {
        console.error(err);
        resolve(1);
      });
    });
  } catch (err) {
    console.error(err);
    exitCode = 1;
  } finally {
    if (pg) {
      try {
        await pg.stop();
      } catch {
        // Ignore stop error
      }
    }
    if (tempDir) {
      for (let i = 0; i < 5; i++) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }
    process.exit(exitCode);
  }
}

main();
