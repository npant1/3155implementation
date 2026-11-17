import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { developmentDatabaseUrl } from './config.js';

export function createDatabase(url = process.env.DATABASE_URL) {
  const adapter = new PrismaPg({ connectionString: developmentDatabaseUrl(url), max: 5, connectionTimeoutMillis: 5000 });
  return new PrismaClient({ adapter });
}
