import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from './generated/prisma/client.js';
import { createMessagingAccess } from './data/messaging.js';
import { createDataAccess } from './data/index.js';
import { id } from './data/validation.js';
import { HttpError, json, jsonBody } from './http-utils.js';

export function createMessagingRoutes(db: PrismaClient, options: { professorId: string; studentId?: string }) {
  const access = createMessagingAccess(db);
  const sessions = new Map<string, { actorId: string; expires: number }>();
  const studentId = options.studentId ?? '22222222-2222-4222-8222-222222222222';
  const cookie = (request: IncomingMessage) => request.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('messaging_session='))?.slice('messaging_session='.length);
  return async function handle(request: IncomingMessage, response: ServerResponse, path: string) {
    if (!path.startsWith('/api/messaging/')) return false;
    if (path === '/api/messaging/dev-session' && request.method === 'POST') {
      const { role } = z.strictObject({ role: z.enum(['STUDENT', 'PROFESSOR']) }).parse(await jsonBody(request));
      const actorId = role === 'STUDENT' ? studentId : options.professorId;
      const user = await access.identity(actorId);
      if (user.role !== role) throw new HttpError(403, 'The sample account has the wrong role.');
      for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
      if (sessions.size >= 100) throw new HttpError(429, 'Too many demo sessions.');
      const old = cookie(request); if (old) sessions.delete(old);
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { actorId, expires: Date.now() + 8 * 3600000 });
      response.setHeader('Set-Cookie', `messaging_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      json(response, 200, { user, developmentSession: true }); return true;
    }
    const token = cookie(request);
    const session = token ? sessions.get(token) : undefined;
    if (!session || session.expires <= Date.now()) { if (token) sessions.delete(token); throw new HttpError(401, 'Sign in to use messages.'); }
    const actorId = session.actorId;
    if (request.headers['x-messaging-actor'] && request.headers['x-messaging-actor'] !== actorId) throw new HttpError(409, 'The messaging account changed in another tab. Reload messages.', 'SESSION_CHANGED');
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (path === '/api/messaging/logout' && request.method === 'POST') {
      sessions.delete(token!); response.setHeader('Set-Cookie', 'messaging_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      json(response, 200, { signedOut: true }); return true;
    }
    if (path === '/api/messaging/me' && request.method === 'GET') { json(response, 200, { user: await access.identity(actorId) }); return true; }
    if (path === '/api/messaging/people' && request.method === 'GET') {
      json(response, 200, await access.directory(actorId, url.searchParams.get('q') ?? '', Number(url.searchParams.get('offset') ?? 0))); return true;
    }
    if (path === '/api/messaging/conversations' && request.method === 'GET') {
      json(response, 200, await access.inbox(actorId, Number(url.searchParams.get('offset') ?? 0))); return true;
    }
    if (path === '/api/messaging/conversations' && request.method === 'POST') {
      const payload = z.strictObject({ otherUserId: id }).parse(await jsonBody(request));
      await access.identity(payload.otherUserId);
      const conversation = await createDataAccess(db).startConversation(actorId, payload.otherUserId);
      json(response, 200, { conversation: { id: conversation.id } }); return true;
    }
    const match = path.match(/^\/api\/messaging\/conversations\/([^/]+)\/messages$/);
    if (match && request.method === 'GET') {
      json(response, 200, await access.history(actorId, id.parse(match[1]), { before: url.searchParams.get('before') ?? undefined, after: url.searchParams.get('after') ?? undefined })); return true;
    }
    if (match && request.method === 'POST') {
      json(response, 200, { message: await access.send(actorId, id.parse(match[1]), await jsonBody(request)) }); return true;
    }
    throw new HttpError(404, 'Messaging endpoint not found.');
  };
}
