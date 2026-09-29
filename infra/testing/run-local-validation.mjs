import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

// Run the existing suites against a disposable server, never the application DB.
const root = fileURLToPath(new URL('../../', import.meta.url));
const runId = randomUUID();
const container = `openclinic-validation-${runId}`;
const output = path.join(root, '.temp', 'validation', runId);
fs.mkdirSync(output, { recursive: true });
const password = randomUUID();
const env = { ...process.env, POSTGRES_PASSWORD: password, DB_HOST: '127.0.0.1',
  DB_NAME: 'postgres', DB_USER: 'postgres', DB_PASS: password };
const results = [];
let created = false;
const docker = (...args) => execFileSync('docker', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function stage(name, args) {
  console.log(`\nRunning: ${name}`);
  const log = fs.createWriteStream(path.join(output, name + '.log'));
  const started = Date.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => log.write(data));
    child.stderr.on('data', data => log.write(data));
    child.on('error', reject);
    child.on('close', value => resolve(value ?? 1));
  }).finally(() => new Promise(resolve => log.end(resolve)));
  results.push({ name, code, durationMs: Date.now() - started, log: path.join(output, name + '.log') });
  console.log(`${name}: ${code === 0 ? 'PASS' : 'FAIL'} (see log)`);
  return code;
}

try {
  docker('run', '--detach', '--name', container, '--label', `openclinic.validation=${runId}`,
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD',
    '--tmpfs', '/var/lib/postgresql/data', 'postgres:17-alpine');
  created = true;
  const binding = docker('port', container, '5432/tcp');
  if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Unexpected Docker port binding');
  env.DB_PORT = binding.split(':')[1];
  env.TEST_PG_CLIENT = '1';
  env.PG_CLIENT_CONTAINER = container;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { docker('exec', container, 'pg_isready', '-U', 'postgres'); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready');
  console.log(`Test database: ${binding}/postgres; reports: ${output}`);
  if (await stage('core-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/core/tsconfig.json'])) {
    throw new Error('Core build failed; remaining suites require its output');
  }
  if (await stage('backend-build', ['node_modules/typescript/bin/tsc', '-p', 'packages/backend-api/tsconfig.json'])) {
    throw new Error('Backend build failed; remaining suites require its output');
  }
  await stage('backend-tests', ['node_modules/vitest/vitest.mjs', 'run', '--root', 'packages/backend-api', '--maxWorkers=2', '--testTimeout=30000']);
  const migrationTests = fs.readdirSync(path.join(root, 'infra/database/tests'))
    .filter(name => /\.test\.(ts|mjs)$/.test(name)).sort().map(name => `infra/database/tests/${name}`);
  await stage('migration-tests', ['--import', 'tsx', '--test', '--test-concurrency=1', ...migrationTests]);
  const functional = await stage('functional-tests', ['infra/testing/run-functional.mjs']);
  if (functional === 0) {
    fs.copyFileSync(path.join(root, 'artifacts/functional-tests.json'), path.join(output, 'functional-tests.json'));
    await stage('specification-readiness', ['infra/testing/agenda-readiness.mjs']);
  }
} catch (error) {
  console.error(error.message);
  results.push({ name: 'runner', code: 1, error: error.message });
} finally {
  if (created) {
    try {
      const label = docker('inspect', '--format', '{{ index .Config.Labels "openclinic.validation" }}', container);
      if (label !== runId) throw new Error('Container ownership verification failed');
      docker('rm', '--force', container);
      console.log('Disposable test container removed.');
    } catch (error) { results.push({ name: 'cleanup', code: 1, error: error.message }); }
  }
  const success = results.length > 0 && results.every(result => result.code === 0);
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ runId, success, results }, null, 2) + '\n');
  console.table(results.map(({ name, code }) => ({ stage: name, result: code === 0 ? 'PASS' : 'FAIL' })));
  console.log(`Report: ${path.join(output, 'summary.json')}`);
  process.exitCode = success ? 0 : 1;
}
