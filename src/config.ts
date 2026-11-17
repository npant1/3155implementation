import 'dotenv/config';

/** All tooling in this branch is deliberately restricted to local development. */
export function developmentDatabaseUrl(value: string | undefined, testOnly = false): string {
  if (process.env.NODE_ENV === 'production') throw new Error('Development database tools cannot run in production.');
  if (!value) throw new Error('Database URL is missing. Copy .env.example to .env and configure a local development database.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Database URL is invalid.'); }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
      || !['127.0.0.1', 'localhost', '[::1]', 'postgres'].includes(url.hostname)
      || !(testOnly ? database.endsWith('_test') : /_(dev|test)$/.test(database))
      || url.searchParams.has('host') || url.searchParams.has('hostaddr')) {
    throw new Error('Only local PostgreSQL databases ending in _dev or _test are allowed; tests require _test.');
  }
  return value;
}
