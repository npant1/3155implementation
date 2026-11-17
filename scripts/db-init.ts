import { spawnSync } from 'node:child_process';
import { developmentDatabaseUrl } from '../src/config.js';

developmentDatabaseUrl(process.env.DATABASE_URL);
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
