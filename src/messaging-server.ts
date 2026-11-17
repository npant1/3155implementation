import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ZodError } from 'zod';
import type { PrismaClient } from './generated/prisma/client.js';
import { DataAccessError } from './data/index.js';
import { HttpError, json } from './http-utils.js';
import { createMessagingRoutes } from './messaging-routes.js';

const ASSETS = ['f11f2','ab844','83cf7','f783a','850ca','dc74e','2117f','8f49d','4184f','1d1ef','59873','2e783','01e82','dfdd3','0c220','3abf1','73998','6c756','69b48','c738a'];
const PUBLIC_FILES = new Set(['index.html', 'app.js', 'messaging.js', 'messaging.css', ...ASSETS.map(name => `assets/messaging/${name}.svg`)]);
const MIME: Record<string, string> = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };

export function createMessagingServer(db: PrismaClient, options: { professorId?: string; studentId?: string; root?: string } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('The sample messaging server is development-only.');
  const root = resolve(options.root ?? process.cwd());
  const messaging = createMessagingRoutes(db, { professorId: options.professorId ?? '11111111-1111-4111-8111-111111111111', studentId: options.studentId });
  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : 8000;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host ?? '')) throw new HttpError(403, 'Invalid development host.');
    const path = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
    if (!['GET', 'HEAD'].includes(request.method ?? '') && request.headers.origin !== `http://${request.headers.host}`) throw new HttpError(403, 'Request origin is not allowed.');
    if (await messaging(request, response, path)) return;
    if (path.startsWith('/api/')) throw new HttpError(404, 'Endpoint not found.');
    if (!['GET', 'HEAD'].includes(request.method ?? '')) throw new HttpError(405, 'Method not allowed.');
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (!PUBLIC_FILES.has(file)) throw new HttpError(404, 'Page not found.');
    const content = await readFile(join(root, file));
    response.writeHead(200, { 'Content-Type': `${MIME[file.split('.').pop() ?? ''] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  }
  const server = createServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) { response.end(); return; }
      if (error instanceof HttpError) json(response, error.status, { message: error.message, ...(error.code ? { code: error.code } : {}) });
      else if (error instanceof DataAccessError) json(response, { FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID: 422 }[error.code], { message: error.message });
      else if (error instanceof ZodError) json(response, 422, { message: 'Please check your input.', issues: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })) });
      else json(response, 503, { message: 'The messaging service is unavailable. Please try again.' });
    });
  });
  server.requestTimeout = 10000;
  return server;
}
