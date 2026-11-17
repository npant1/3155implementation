import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { developmentDatabaseUrl } from './src/config.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: developmentDatabaseUrl(process.env.DATABASE_URL ?? 'postgresql://unconfigured:unconfigured@127.0.0.1:55432/campus_dev') },
});
