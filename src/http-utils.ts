import type { IncomingMessage, ServerResponse } from 'node:http';
export class HttpError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
export function body(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((accept, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= limit) chunks.push(chunk); });
    request.on('end', () => size > limit ? reject(new HttpError(413, 'The selected file or request is too large.')) : accept(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}
export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
export async function jsonBody(request: IncomingMessage) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new HttpError(415, 'Use JSON.');
  try { return JSON.parse((await body(request, 32768)).toString()); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON request.'); }
}
