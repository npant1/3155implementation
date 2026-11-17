import { z } from 'zod';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { id, messageBody } from './validation.js';
import { DataAccessError } from './index.js';

const pagination = z.number().int().min(0).max(100000);
const search = z.string().trim().max(100);
export const outgoingMessage = z.strictObject({ body: messageBody, clientMessageId: id });
export type Person = { id: string; role: 'STUDENT' | 'PROFESSOR'; name: string; subtitle: string; topics: string };
export function createMessagingAccess(db: PrismaClient) {
  async function identity(actorId: string): Promise<Person> {
    const user = await db.user.findUnique({ where: { id: id.parse(actorId) }, include: { studentProfile: true, professorProfile: true } });
    if (!user) throw new DataAccessError('FORBIDDEN', 'Sign in to use messages.');
    const profile = user.role === 'STUDENT' ? user.studentProfile : user.professorProfile;
    if (!profile) throw new DataAccessError('FORBIDDEN', 'Create a profile before using messages.');
    return { id: user.id, role: user.role, name: profile.displayName,
      subtitle: user.role === 'STUDENT' ? user.studentProfile!.major : user.professorProfile!.department,
      topics: user.professorProfile?.researchAreas.join(', ') ?? user.studentProfile?.concentration ?? '' };
  }
  async function conversation(actorId: string, conversationId: string) {
    await identity(actorId);
    const value = await db.conversation.findFirst({ where: { id: id.parse(conversationId), OR: [{ studentId: actorId }, { professorId: actorId }] },
      include: { student: true, professor: true } });
    if (!value) throw new DataAccessError('FORBIDDEN', 'This conversation is unavailable.');
    return value;
  }
  function peer(value: Awaited<ReturnType<typeof conversation>>, actorId: string): Person {
    return value.studentId === actorId
      ? { id: value.professorId, role: 'PROFESSOR', name: value.professor.displayName, subtitle: value.professor.department, topics: value.professor.researchAreas.join(', ') }
      : { id: value.studentId, role: 'STUDENT', name: value.student.displayName, subtitle: value.student.major, topics: value.student.concentration ?? '' };
  }
  return {
    identity,
    async directory(actorId: string, query = '', offset = 0) {
      const who = await identity(actorId);
      const pattern = `%${search.parse(query).replace(/[\\%_]/g, '\\$&')}%`;
      pagination.parse(offset);
      const rows = who.role === 'STUDENT'
        ? await db.$queryRaw<Person[]>(Prisma.sql`
          SELECT u.id, u.role, p."displayName" AS name, p.department AS subtitle, array_to_string(p."researchAreas", ', ') AS topics
          FROM "User" u JOIN "ProfessorProfile" p ON p."userId" = u.id
          WHERE u.role = 'PROFESSOR' AND (p."displayName" ILIKE ${pattern} OR p.department ILIKE ${pattern}
            OR array_to_string(p."researchAreas", ' ') ILIKE ${pattern} OR EXISTS
            (SELECT 1 FROM "Opportunity" o WHERE o."professorId" = u.id AND o.status = 'PUBLISHED'
             AND (o.title ILIKE ${pattern} OR o.description ILIKE ${pattern})))
          ORDER BY p."displayName", u.id LIMIT 31 OFFSET ${offset}`)
        : await db.$queryRaw<Person[]>(Prisma.sql`
          SELECT u.id, u.role, s."displayName" AS name, s.major AS subtitle, COALESCE(s.concentration, '') AS topics
          FROM "User" u JOIN "StudentProfile" s ON s."userId" = u.id
          WHERE u.role = 'STUDENT' AND (s."displayName" ILIKE ${pattern} OR s.major ILIKE ${pattern} OR COALESCE(s.concentration, '') ILIKE ${pattern})
          ORDER BY s."displayName", u.id LIMIT 31 OFFSET ${offset}`);
      return { people: rows.slice(0, 30), hasMore: rows.length > 30 };
    },
    async inbox(actorId: string, offset = 0) {
      await identity(actorId); pagination.parse(offset);
      const rows = await db.conversation.findMany({ where: { OR: [{ studentId: actorId }, { professorId: actorId }] },
        include: { student: true, professor: true, messages: { orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 1 } },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }], take: 31, skip: offset });
      return { conversations: rows.slice(0, 30).map(row => ({ id: row.id, peer: peer(row, actorId), lastMessage: row.messages[0] ?? null, updatedAt: row.lastMessageAt })), hasMore: rows.length > 30 };
    },
    async history(actorId: string, conversationId: string, cursor?: { before?: string; after?: string }) {
      const value = await conversation(actorId, conversationId);
      if (cursor?.before && cursor.after) throw new DataAccessError('INVALID', 'Choose only one message cursor.');
      const cursorId = cursor?.before ?? cursor?.after;
      let range: Prisma.MessageWhereInput = {};
      if (cursorId) {
        const anchor = await db.message.findFirst({ where: { id: id.parse(cursorId), conversationId } });
        if (!anchor) throw new DataAccessError('INVALID', 'The message cursor is unavailable.');
        range = cursor?.after ? { OR: [{ sentAt: { gt: anchor.sentAt } }, { sentAt: anchor.sentAt, id: { gt: anchor.id } }] }
          : { OR: [{ sentAt: { lt: anchor.sentAt } }, { sentAt: anchor.sentAt, id: { lt: anchor.id } }] };
      }
      const ascending = Boolean(cursor?.after);
      const rows = await db.message.findMany({ where: { conversationId, ...range }, orderBy: [{ sentAt: ascending ? 'asc' : 'desc' }, { id: ascending ? 'asc' : 'desc' }], take: 51 });
      const items = rows.slice(0, 50);
      return { conversation: { id: value.id, peer: peer(value, actorId) }, messages: ascending ? items : items.reverse(), hasMore: rows.length > 50 };
    },
    async send(actorId: string, conversationId: string, input: unknown) {
      await conversation(actorId, conversationId);
      const payload = outgoingMessage.parse(input);
      const result = await db.message.upsert({ where: { senderId_clientMessageId: { senderId: actorId, clientMessageId: payload.clientMessageId } }, update: {},
        create: { conversationId, senderId: actorId, ...payload } });
      if (result.conversationId !== conversationId || result.body !== payload.body) throw new DataAccessError('CONFLICT', 'This send identifier was already used for a different message.');
      return result;
    },
  };
}
