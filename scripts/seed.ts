import { createDatabase } from '../src/db.js';

const db = createDatabase();
const ids = {
  professor: '11111111-1111-4111-8111-111111111111',
  student: '22222222-2222-4222-8222-222222222222',
  area: '33333333-3333-4333-8333-333333333333',
  post: '44444444-4444-4444-8444-444444444444',
  draft: '55555555-5555-4555-8555-555555555555',
  conversation: '66666666-6666-4666-8666-666666666666',
  message: '77777777-7777-4777-8777-777777777777',
  application: '88888888-8888-4888-8888-888888888888',
};
try {
  await db.$transaction(async tx => {
    // Non-destructive: a rerun only creates missing sample records, preserving edits.
    await tx.user.upsert({ where: { id: ids.professor }, update: {}, create: {
      id: ids.professor, email: 'alex.morgan@example.test', authSubject: 'development:professor:alex', role: 'PROFESSOR',
    } });
    await tx.user.upsert({ where: { id: ids.student }, update: {}, create: {
      id: ids.student, email: 'jamie.rivera@example.test', authSubject: 'development:student:jamie', role: 'STUDENT',
    } });
    await tx.professorProfile.upsert({ where: { userId: ids.professor }, update: {}, create: {
      userId: ids.professor, displayName: 'Professor Alex Morgan', degree: 'Ph.D. Computer Science',
      department: 'Computer Science', education: 'Synthetic development profile; not a real faculty member.',
      about: 'Our sample lab explores accessible learning tools and undergraduate research.',
      researchAreas: ['Artificial intelligence', 'Accessibility'], contactEmail: 'alex.morgan@example.test',
      officeHours: 'Tuesdays 11 AM–12 PM (sample)',
    } });
    await tx.studentProfile.upsert({ where: { userId: ids.student }, update: {}, create: {
      userId: ids.student, displayName: 'Jamie Rivera', major: 'Computer Science', year: 'Junior',
      about: 'Synthetic student interested in accessible technology.',
    } });
    await tx.researchArea.upsert({ where: { id: ids.area }, update: {}, create: { id: ids.area, name: 'Artificial intelligence' } });
    await tx.opportunity.upsert({ where: { id: ids.post }, update: {}, create: {
      id: ids.post, professorId: ids.professor, title: 'AI Tools for Accessible Learning',
      description: 'Sample opportunity inspired by the team research-listings prototype.',
      responsibilities: ['Review accessible course materials'], goals: ['Evaluate a sample learning tool'],
      prerequisites: ['Introductory programming'], duration: 'One semester', hoursMin: 6, hoursMax: 8,
      deadline: new Date(Date.now() + 90 * 86400000), status: 'PUBLISHED', publishedAt: new Date(),
      researchAreas: { create: { researchAreaId: ids.area } },
    } });
    await tx.opportunity.upsert({ where: { id: ids.draft }, update: {}, create: {
      id: ids.draft, professorId: ids.professor, title: 'Unpublished sample draft',
      responsibilities: [], goals: [], prerequisites: [],
    } });
    if (!await tx.application.findUnique({ where: { id: ids.application } })) {
      const post = await tx.opportunity.findUniqueOrThrow({ where: { id: ids.post } });
      if (post.status === 'PUBLISHED' && post.deadline && post.deadline > new Date()) {
        await tx.application.create({ data: { id: ids.application, studentId: ids.student, opportunityId: ids.post } });
      }
    }
    await tx.conversation.upsert({ where: { id: ids.conversation }, update: {}, create: {
      id: ids.conversation, studentId: ids.student, professorId: ids.professor,
    } });
    await tx.message.upsert({ where: { id: ids.message }, update: {}, create: {
      id: ids.message, conversationId: ids.conversation, senderId: ids.student,
      body: 'Hello! Could you tell me more about the sample research opportunity?',
    } });
  });
  console.log('Synthetic development data is ready. Existing records were preserved.');
} finally { await db.$disconnect(); }
