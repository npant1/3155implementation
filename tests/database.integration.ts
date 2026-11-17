import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createDatabase } from '../src/db.js';
import { createDataAccess, DataAccessError } from '../src/data/index.js';
import { developmentDatabaseUrl } from '../src/config.js';

// Deliberately refuse development and production targets. No TRUNCATE or global reset.
developmentDatabaseUrl(process.env.DATABASE_URL, true);
const db = createDatabase();
const data = createDataAccess(db);
const ids = { professor: randomUUID(), otherProfessor: randomUUID(), student: randomUUID(), outsider: randomUUID(), area: randomUUID() };
const fields = { displayName: 'Test Professor', degree: 'Ph.D.', department: 'Computing', education: 'Test education', about: 'Test biography', researchAreas: ['AI'], contactEmail: 'profile@example.test', virtualOfficeUrl: 'https://example.test/office', officeHours: 'Monday' };
const student = { displayName: 'Test Student', major: 'Computing', concentration: null, year: 'Senior', about: '' };
let postId: string;
let applicationId: string;
let conversationId: string;

before(async () => {
  await db.$connect();
  for (const [key, role] of [['professor', 'PROFESSOR'], ['otherProfessor', 'PROFESSOR'], ['student', 'STUDENT'], ['outsider', 'STUDENT']] as const) {
    await db.user.create({ data: { id: ids[key], role, email: `${ids[key]}@example.test` } });
  }
  await data.createProfessorProfile(ids.professor, fields);
  await data.createProfessorProfile(ids.otherProfessor, fields);
  await data.createStudentProfile(ids.student, student);
  await data.createStudentProfile(ids.outsider, student);
  await db.researchArea.create({ data: { id: ids.area, name: `Test area ${ids.area}` } });
});
after(async () => {
  const users = Object.values(ids).filter(value => value !== ids.area);
  try {
    await db.message.deleteMany({ where: { senderId: { in: users } } });
    await db.conversation.deleteMany({ where: { OR: [{ studentId: { in: users } }, { professorId: { in: users } }] } });
    await db.application.deleteMany({ where: { studentId: { in: users } } });
    // Deleting a post cascades its area links in the same statement.
    await db.opportunity.deleteMany({ where: { professorId: { in: users } } });
    await db.professorProfile.deleteMany({ where: { userId: { in: users } } });
    await db.studentProfile.deleteMany({ where: { userId: { in: users } } });
    await db.fileAsset.deleteMany({ where: { ownerId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.researchArea.deleteMany({ where: { id: ids.area } });
  } finally { await db.$disconnect(); }
});

test('professor CRUD persists across clients and rejects stale/concurrent writes', async () => {
  const saved = await data.updateProfessorProfile(ids.professor, { ...fields, displayName: 'Saved Name', expectedVersion: 1 });
  assert.equal(saved.version, 2);
  const second = createDatabase();
  try { assert.equal((await second.professorProfile.findUniqueOrThrow({ where: { userId: ids.professor } })).displayName, 'Saved Name'); }
  finally { await second.$disconnect(); }
  await assert.rejects(data.updateProfessorProfile(ids.professor, { ...fields, expectedVersion: 1 }), (e: unknown) => e instanceof DataAccessError && e.code === 'CONFLICT');
  const outcomes = await Promise.allSettled(['First', 'Second'].map(displayName => data.updateProfessorProfile(ids.professor, { ...fields, displayName, expectedVersion: 2 })));
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
});
test('wrong roles and owner mass-assignment are rejected; failed update preserves data', async () => {
  await assert.rejects(data.getProfessorProfile(ids.student));
  await assert.rejects(data.updateProfessorProfile(ids.professor, { ...fields, userId: ids.otherProfessor, expectedVersion: 3 }));
  await assert.rejects(db.professorProfile.create({ data: { userId: ids.student, displayName: 'Invalid role', researchAreas: [] } }));
  await assert.rejects(db.user.update({ where: { id: ids.professor }, data: { role: 'STUDENT' } }));
  const prior = await data.getProfessorProfile(ids.professor);
  await assert.rejects(db.professorProfile.update({ where: { userId: ids.professor }, data: { displayName: ' ', version: { increment: 1 } } }));
  assert.equal((await data.getProfessorProfile(ids.professor))?.displayName, prior?.displayName);
});
test('file ownership, purpose and resume snapshot survive profile replacement', async () => {
  const resume = await data.registerFile(ids.student, { storageKey: `test/${randomUUID()}.pdf`, originalName: 'resume.pdf', mediaType: 'application/pdf', sizeBytes: 123, purpose: 'RESUME' });
  await data.attachProfileFile(ids.student, resume.id, 1);
  await assert.rejects(data.attachProfileFile(ids.outsider, resume.id, 1));
  await assert.rejects(db.studentProfile.update({ where: { userId: ids.outsider }, data: { resumeId: resume.id, version: { increment: 1 } } }));
  await assert.rejects(db.studentProfile.update({ where: { userId: ids.student }, data: { photoId: resume.id, version: { increment: 1 } } }));
});
test('draft/published listings, application uniqueness, and owner decisions', async () => {
  const post = await data.createOpportunity(ids.professor, {
    title: 'Test research', description: 'Description', responsibilities: ['Research'], goals: ['Learn'], prerequisites: ['Programming'],
    duration: 'One semester', hoursMin: 5, hoursMax: 8, deadline: new Date(Date.now() + 86400000), researchAreaIds: [ids.area],
  });
  postId = post.id;
  assert.equal((await data.listPublishedOpportunities()).some(p => p.id === post.id), false);
  await assert.rejects(data.publishOpportunity(ids.otherProfessor, post.id));
  await data.publishOpportunity(ids.professor, post.id);
  assert.equal((await data.listPublishedOpportunities()).some(p => p.id === post.id), true);
  const application = await data.apply(ids.student, post.id);
  applicationId = application.id;
  assert.ok(application.resumeFileId);
  const replacement = await data.registerFile(ids.student, { storageKey: `test/${randomUUID()}.pdf`, originalName: 'new.pdf', mediaType: 'application/pdf', sizeBytes: 124, purpose: 'RESUME' });
  await data.attachProfileFile(ids.student, replacement.id, 2);
  assert.equal((await db.application.findUniqueOrThrow({ where: { id: application.id } })).resumeFileId, application.resumeFileId);
  await assert.rejects(db.fileAsset.delete({ where: { id: application.resumeFileId! } }));
  await assert.rejects(data.apply(ids.student, post.id), (e: unknown) => e instanceof DataAccessError && e.code === 'CONFLICT');
  await assert.rejects(data.decideApplication(ids.otherProfessor, application.id, { status: 'ACCEPTED', denialReason: null }));
  await assert.rejects(data.decideApplication(ids.professor, application.id, { status: 'DECLINED', denialReason: ' ' }));
  await data.decideApplication(ids.professor, application.id, { status: 'DECLINED', denialReason: 'Prerequisite coursework required.' });
  assert.equal((await data.listStudentApplications(ids.student))[0].denialReason, 'Prerequisite coursework required.');
  await assert.rejects(data.decideApplication(ids.professor, application.id, { status: 'ACCEPTED', denialReason: null }));
});
test('database rejects bypassed publication and decision rules', async () => {
  await assert.rejects(db.opportunity.create({ data: { professorId: ids.professor, title: 'Incomplete', status: 'PUBLISHED', responsibilities: [], goals: [], prerequisites: [] } }));
  await assert.rejects(db.application.update({ where: { id: applicationId }, data: { status: 'ACCEPTED', denialReason: null, decidedById: ids.otherProfessor } }));
  await db.opportunity.update({ where: { id: postId }, data: { deadline: new Date(Date.now() - 1000) } });
  await assert.rejects(data.apply(ids.outsider, postId));
});
test('conversation pair uniqueness, message persistence, outsider rejection and sender constraints', async () => {
  const conversation = await data.startConversation(ids.student, ids.professor);
  conversationId = conversation.id;
  assert.equal((await data.startConversation(ids.professor, ids.student)).id, conversationId);
  await data.sendMessage(ids.student, conversation.id, ' Hello ');
  await data.sendMessage(ids.professor, conversation.id, 'Welcome');
  assert.deepEqual((await data.readMessages(ids.student, conversation.id)).map(m => m.body), ['Hello', 'Welcome']);
  await assert.rejects(data.sendMessage(ids.outsider, conversation.id, 'Not allowed'));
  await assert.rejects(data.readMessages(ids.outsider, conversation.id));
  await assert.rejects(db.message.create({ data: { conversationId, senderId: ids.outsider, body: 'Bypass attempt' } }));
  await assert.rejects(data.sendMessage(ids.student, conversation.id, ' '));
});

test('SQL list constraints and deferred area checks cannot be bypassed', async () => {
  const prior = await data.getProfessorProfile(ids.professor);
  await assert.rejects(db.professorProfile.update({ where: { userId: ids.professor }, data: { researchAreas: ['AI', 'ai'], version: { increment: 1 } } }));
  await assert.rejects(db.$executeRaw`UPDATE "ProfessorProfile" SET "researchAreas" = NULL, version = version + 1 WHERE "userId" = ${ids.professor}::uuid`);
  assert.equal((await data.getProfessorProfile(ids.professor))?.version, prior?.version);
  await assert.rejects(db.opportunityResearchArea.deleteMany({ where: { opportunityId: postId } }));
  assert.equal(await db.opportunityResearchArea.count({ where: { opportunityId: postId } }), 1);
});
