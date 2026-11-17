import { spawnSync } from 'node:child_process';
import { developmentDatabaseUrl } from '../src/config.js';

const url = developmentDatabaseUrl(process.env.TEST_DATABASE_URL, true);
const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' };
for (const args of [
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  ['--import', 'tsx', '--test', 'tests/database.integration.ts', 'tests/messaging.integration.ts'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
