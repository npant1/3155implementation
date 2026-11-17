import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createDatabase } from '../src/db.js';
import { createDataAccess } from '../src/data/index.js';
import { createMessagingAccess } from '../src/data/messaging.js';
import { createMessagingServer } from '../src/messaging-server.js';
import { developmentDatabaseUrl } from '../src/config.js';

developmentDatabaseUrl(process.env.DATABASE_URL, true);
const db = createDatabase(), data = createDataAccess(db), messages = createMessagingAccess(db);
const studentId = randomUUID(), professorId = randomUUID(), outsiderId = randomUUID(), secondProfessorId = randomUUID(), areaId = randomUUID();
const tag = randomUUID().slice(0, 8);
let server: ReturnType<typeof createMessagingServer>, base: string, conversationId: string;
function client() {
  let cookie = '';
  return async (path: string, options: RequestInit = {}) => {
    const response = await fetch(base + path, { ...options, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
    const changed = response.headers.get('set-cookie'); if (changed) cookie = changed.split(';')[0];
    return response;
  };
}
const student = client(), professor = client();
const jsonHeaders = { 'Content-Type': 'application/json' };
async function signIn(request: ReturnType<typeof client>, role: string) {
  const response = await request('/api/messaging/dev-session', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ role }) });
  assert.equal(response.status, 200); return response;
}
before(async () => {
  for (const [id, role] of [[studentId, 'STUDENT'], [professorId, 'PROFESSOR'], [outsiderId, 'STUDENT'], [secondProfessorId, 'PROFESSOR']] as const) {
    await db.user.create({ data: { id, role, email: `${id}@example.test` } });
  }
  await data.createProfessorProfile(professorId, { displayName: `Professor ${tag}`, degree: '', department: `Computing ${tag}`, education: '', about: '', researchAreas: [`Quant${tag}`], contactEmail: null, virtualOfficeUrl: null, officeHours: '' });
  await data.createProfessorProfile(secondProfessorId, { displayName: `Other Faculty ${tag}`, degree: '', department: 'History', education: '', about: '', researchAreas: [], contactEmail: null, virtualOfficeUrl: null, officeHours: '' });
  for (const id of [studentId, outsiderId]) await data.createStudentProfile(id, { displayName: `${id === studentId ? 'Student' : 'Other'} ${tag}`, major: `Robotics ${tag}`, concentration: null, year: 'Senior', about: '' });
  await db.researchArea.create({ data: { id: areaId, name: `Area ${tag}` } });
  const post = await data.createOpportunity(professorId, { title: `Study ${tag}`, description: `Unique research ${tag}`, responsibilities: ['Research'], goals: ['Learn'], prerequisites: ['Programming'], duration: 'Semester', hoursMin: 4, hoursMax: 8, deadline: new Date(Date.now() + 86400000), researchAreaIds: [areaId] });
  await data.publishOpportunity(professorId, post.id);
  conversationId = (await data.startConversation(studentId, professorId)).id;
  const start = Date.now() - 86400000;
  await db.message.createMany({ data: Array.from({ length: 60 }, (_, index) => ({ conversationId, senderId: index % 2 ? studentId : professorId, body: `History ${index}`, sentAt: new Date(start + index * 1000) })) });
  server = createMessagingServer(db, { professorId, studentId });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object'); base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  try {
    const ids = [studentId, professorId, outsiderId, secondProfessorId];
    await db.message.deleteMany({ where: { senderId: { in: ids } } });
    await db.conversation.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { professorId: { in: ids } }] } });
    await db.opportunity.deleteMany({ where: { professorId } });
    await db.professorProfile.deleteMany({ where: { userId: { in: [professorId, secondProfessorId] } } });
    await db.studentProfile.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.researchArea.deleteMany({ where: { id: areaId } });
  } finally { await db.$disconnect(); }
});
test('messaging requires a session and same origin; sample identity cannot be spoofed', async () => {
  assert.equal((await student('/api/messaging/me')).status, 401);
  const landing = await student('/');
  const html = await landing.text();
  assert.match(html, /Messages \| Campus Research/);
  assert.doesNotMatch(html, /src="(?:profile|professor)\.js/);
  for (const path of ['/profile.js', '/professor.js', '/api/professor/profile']) assert.equal((await student(path)).status, 404);
  assert.equal((await student('/api/messaging/dev-session', { method: 'POST', headers: { ...jsonHeaders, Origin: 'https://attacker.test' }, body: '{"role":"STUDENT"}' })).status, 403);
  assert.equal((await student('/api/messaging/dev-session', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ role: 'STUDENT', actorId: outsiderId }) })).status, 422);
  const response = await signIn(student, 'STUDENT');
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/);
  await signIn(professor, 'PROFESSOR');
  assert.equal((await (await student('/api/messaging/me')).json()).user.id, studentId);
  const changedAccount = await student(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: { ...jsonHeaders, 'X-Messaging-Actor': professorId }, body: JSON.stringify({ body: 'Wrong visible account', clientMessageId: randomUUID() }) });
  assert.equal(changedAccount.status, 409); assert.equal((await changedAccount.json()).code, 'SESSION_CHANGED');
  assert.equal(await db.message.count({ where: { conversationId, body: 'Wrong visible account' } }), 0);
});
test('students find professors by name/research and professors find students by major', async () => {
  for (const query of [`Professor ${tag}`, `quant${tag}`, `Study ${tag}`]) {
    const result = await (await student(`/api/messaging/people?q=${encodeURIComponent(query)}`)).json();
    assert.equal(result.people[0].id, professorId);
    assert.ok(result.people.every((p: { role: string }) => p.role === 'PROFESSOR'));
    assert.equal(result.people[0].email, undefined);
  }
  const students = await (await professor(`/api/messaging/people?q=${encodeURIComponent(`Robotics ${tag}`)}`)).json();
  assert.equal(students.people.length, 2);
  const wildcard = await (await student('/api/messaging/people?q=%25%27%20OR%201%3D1')).json();
  assert.equal(wildcard.people.length, 0);
});
test('history is chronological, paged without loss, and forbidden to outsiders', async () => {
  const result = await (await student(`/api/messaging/conversations/${conversationId}/messages`)).json();
  assert.equal(result.messages.length, 50); assert.equal(result.messages[0].body, 'History 10'); assert.equal(result.hasMore, true);
  const older = await (await student(`/api/messaging/conversations/${conversationId}/messages?before=${result.messages[0].id}`)).json();
  assert.equal(older.messages.length, 10); assert.equal(older.messages[0].body, 'History 0'); assert.equal(older.hasMore, false);
  await assert.rejects(messages.history(outsiderId, conversationId));
  const peerConversation = await data.startConversation(outsiderId, professorId);
  const wrongCursor = await db.message.create({ data: { conversationId: peerConversation.id, senderId: outsiderId, body: 'Private' } });
  assert.equal((await student(`/api/messaging/conversations/${conversationId}/messages?before=${wrongCursor.id}`)).status, 422);
});
test('conversation creation is duplicate-safe, validates peers, and sends in both directions', async () => {
  const response = await student('/api/messaging/conversations', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ otherUserId: professorId }) });
  assert.equal((await response.json()).conversation.id, conversationId);
  assert.equal((await student('/api/messaging/conversations', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ otherUserId: outsiderId }) })).status, 422);
  const studentMessage = { body: 'A student question', clientMessageId: randomUUID() };
  const result = await student(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(studentMessage) });
  assert.equal(result.status, 200);
  const reply = await professor(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ body: 'A professor answer', clientMessageId: randomUUID() }) });
  assert.equal(reply.status, 200);
  const body = await reply.json(); assert.equal(body.message.senderId, professorId);
  const changed = await messages.history(studentId, conversationId, { after: (await result.json()).message.id });
  assert.ok(changed.messages.some(m => m.body === 'A professor answer'));
  const inbox = await (await student('/api/messaging/conversations')).json();
  assert.equal(inbox.conversations[0].lastMessage.body, 'A professor answer');
});
test('starting a new peer conversation shows empty history without exposing another pair', async () => {
  const response = await student('/api/messaging/conversations', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ otherUserId: secondProfessorId }) });
  const value = await response.json();
  const history = await (await student(`/api/messaging/conversations/${value.conversation.id}/messages`)).json();
  assert.deepEqual(history.messages, []); assert.equal(history.hasMore, false);
  assert.equal((await professor(`/api/messaging/conversations/${value.conversation.id}/messages`)).status, 403);
});
test('retry identifiers deduplicate concurrent sends and cannot be reused for different text', async () => {
  const payload = { body: 'Send once, even after timeout', clientMessageId: randomUUID() };
  const send = () => student(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
  const pair = await Promise.all([send(), send()]);
  assert.deepEqual(pair.map(p => p.status), [200, 200]);
  assert.equal(await db.message.count({ where: { senderId: studentId, clientMessageId: payload.clientMessageId } }), 1);
  assert.equal((await student(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ ...payload, body: 'Different text' }) })).status, 409);
  for (const invalid of [{ body: ' ', clientMessageId: randomUUID() }, { body: 'x'.repeat(5001), clientMessageId: randomUUID() }, { ...payload, senderId: outsiderId }]) {
    assert.equal((await student(`/api/messaging/conversations/${conversationId}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(invalid) })).status, 422);
  }
});
async function waitFor(check: () => boolean) {
  for (let n = 0; n < 300; n += 1) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('Expected messaging UI state did not arrive.');
}
test('actual messaging DOM finds people, opens history, sends safely, recovers a lost acknowledgement and refreshes replies', async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: `${base}/#/messages`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let tick: (() => Promise<void>) | undefined;
  let loseAck = true;
  let pauseChat = false;
  let releaseChat: (() => void) | undefined;
  Object.assign(w, { app: w.document.querySelector('#app'),
    fetch: async (path: string, options: RequestInit = {}) => {
      if (pauseChat && path === `/api/messaging/conversations/${conversationId}/messages` && !options.method) { pauseChat = false; await new Promise<void>(resolve => { releaseChat = resolve; }); }
      const response = await student(path, options);
      if (loseAck && options.method === 'POST' && path.endsWith('/messages')) { loseAck = false; throw new Error('Lost acknowledgement'); }
      return response;
    }, setInterval: (callback: () => Promise<void>) => { tick = callback; return 1; }, clearInterval: () => undefined });
  w.eval(await readFile('messaging.js', 'utf8'));
  const views = w as unknown as { renderMessaging: () => Promise<void> };
  try {
    await views.renderMessaging();
    const doc = w.document;
    assert.equal(doc.querySelector('h1')?.textContent, 'Messages');
    (doc.querySelector('#msg-people-tab') as HTMLButtonElement).click();
    const query = doc.querySelector('#msg-query') as HTMLInputElement; query.value = `quant${tag}`; query.dispatchEvent(new w.Event('input'));
    await waitFor(() => [...doc.querySelectorAll('[data-message-row]')].some(node => (node as HTMLElement).dataset.messageRow === professorId));
    pauseChat = true;
    (doc.querySelector(`[data-message-row="${professorId}"]`) as HTMLButtonElement).click();
    await waitFor(() => Boolean(releaseChat));
    assert.equal((doc.querySelector('#msg-body') as HTMLTextAreaElement).disabled, true, 'Old recipient cannot be sent to while switching');
    releaseChat!();
    await waitFor(() => doc.querySelector('#msg-chat h3')?.textContent === `Professor ${tag}` && doc.querySelector('#msg-status')?.textContent === '' && doc.querySelector('#msg-chat')?.getAttribute('aria-busy') === 'false');
    const input = doc.querySelector('#msg-body') as HTMLTextAreaElement;
    const text = `<img src=x onerror=alert(1)> ${tag}`;
    input.value = text; input.dispatchEvent(new w.Event('input'));
    doc.querySelector('#msg-composer')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => doc.querySelector('#msg-send')?.textContent === 'Retry');
    assert.equal(input.value, text);
    doc.querySelector('#msg-composer')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => doc.querySelector('#msg-status')?.textContent === 'Message sent.');
    assert.equal(input.value, '');
    assert.equal(await db.message.count({ where: { conversationId, body: text } }), 1);
    assert.equal(doc.querySelector('.msg-bubble img'), null);
    assert.ok(doc.querySelector('#msg-history')?.textContent?.includes(text));
    const reply = `DOM reply ${tag}`;
    await messages.send(professorId, conversationId, { body: reply, clientMessageId: randomUUID() });
    assert.ok(tick); await tick();
    assert.ok(doc.querySelector('#msg-history')?.textContent?.includes(reply));
    (doc.querySelector('#msg-older') as HTMLButtonElement).click();
    await waitFor(() => doc.querySelector('#msg-history')?.textContent?.includes('History 0') ?? false);
    // Search has a meaningful no-match state without discarding the current chat.
    (doc.querySelector('#msg-people-tab') as HTMLButtonElement).click(); query.value = `nobody-${randomUUID()}`; query.dispatchEvent(new w.Event('input'));
    await waitFor(() => doc.querySelector('#msg-list')?.textContent?.includes('No matches') ?? false);
  } finally { w.close(); }
});
test('logout revokes session while a new session can still read persisted history', async () => {
  assert.equal((await student('/api/messaging/logout', { method: 'POST' })).status, 200);
  assert.equal((await student('/api/messaging/conversations')).status, 401);
  await signIn(student, 'STUDENT');
  const result = await (await student(`/api/messaging/conversations/${conversationId}/messages`)).json();
  assert.ok(result.messages.some((m: { body: string }) => m.body === `DOM reply ${tag}`));
});
