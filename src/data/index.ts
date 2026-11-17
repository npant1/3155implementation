import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { id, professorFields, professorUpdate, studentFields, fileFields, opportunityFields, decisionFields, messageBody } from './validation.js';

export class DataAccessError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID', message: string) { super(message); }
}

/** Server-only API. actorId must come from a trusted authenticated session. */
export function createDataAccess(db: PrismaClient) {
  async function actor(actorId: string, role?: 'PROFESSOR' | 'STUDENT') {
    const user = await db.user.findUnique({ where: { id: id.parse(actorId) } });
    if (!user || (role && user.role !== role)) throw new DataAccessError('FORBIDDEN', 'This action is not allowed.');
    return user;
  }
  return {
    async getProfessorProfile(actorId: string) {
      await actor(actorId, 'PROFESSOR');
      return db.professorProfile.findUnique({ where: { userId: actorId }, include: { photo: true } });
    },
    async createProfessorProfile(actorId: string, input: unknown) {
      await actor(actorId, 'PROFESSOR');
      return db.professorProfile.create({ data: { ...professorFields.parse(input), userId: actorId } });
    },
    async updateProfessorProfile(actorId: string, input: unknown) {
      await actor(actorId, 'PROFESSOR');
      const { expectedVersion, ...fields } = professorUpdate.parse(input);
      return db.$transaction(async tx => {
        const result = await tx.professorProfile.updateMany({ where: { userId: actorId, version: expectedVersion },
          data: { ...fields, version: { increment: 1 } } });
        if (!result.count) throw new DataAccessError('CONFLICT', 'The profile changed or no longer exists. Reload before saving.');
        return tx.professorProfile.findUniqueOrThrow({ where: { userId: actorId }, include: { photo: true } });
      });
    },
    async getStudentProfile(actorId: string) {
      await actor(actorId, 'STUDENT');
      return db.studentProfile.findUnique({ where: { userId: actorId }, include: { photo: true, resume: true } });
    },
    async createStudentProfile(actorId: string, input: unknown) {
      await actor(actorId, 'STUDENT');
      return db.studentProfile.create({ data: { ...studentFields.parse(input), userId: actorId } });
    },
    async updateStudentProfile(actorId: string, input: unknown, expectedVersion: number) {
      await actor(actorId, 'STUDENT');
      const fields = studentFields.parse(input);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new DataAccessError('INVALID', 'Invalid profile version.');
      return db.$transaction(async tx => {
        const changed = await tx.studentProfile.updateMany({ where: { userId: actorId, version: expectedVersion }, data: { ...fields, version: { increment: 1 } } });
        if (!changed.count) throw new DataAccessError('CONFLICT', 'Reload the changed profile.');
        return tx.studentProfile.findUniqueOrThrow({ where: { userId: actorId } });
      });
    },
    async registerFile(actorId: string, input: unknown) {
      const user = await actor(actorId);
      const fields = fileFields.parse(input);
      if (fields.purpose === 'RESUME' && user.role !== 'STUDENT') throw new DataAccessError('FORBIDDEN', 'Only students have resumes.');
      return db.fileAsset.create({ data: { ...fields, ownerId: actorId } });
    },
    async attachProfileFile(actorId: string, fileId: string, expectedVersion: number) {
      const user = await actor(actorId);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new DataAccessError('INVALID', 'Invalid profile version.');
      const file = await db.fileAsset.findFirst({ where: { id: id.parse(fileId), ownerId: actorId } });
      if (!file || (user.role === 'PROFESSOR' && file.purpose !== 'PHOTO')) throw new DataAccessError('FORBIDDEN', 'File is not available for this profile.');
      const data = { [file.purpose === 'PHOTO' ? 'photoId' : 'resumeId']: fileId, version: { increment: 1 } };
      const where = { userId: actorId, version: expectedVersion };
      const updated = user.role === 'PROFESSOR'
        ? await db.professorProfile.updateMany({ where, data })
        : await db.studentProfile.updateMany({ where, data });
      if (!updated.count) throw new DataAccessError('CONFLICT', 'Reload the changed profile.');
    },
    async listPublishedOpportunities() {
      return db.opportunity.findMany({ where: { status: 'PUBLISHED' },
        include: { professor: { select: { userId: true, displayName: true, department: true } }, researchAreas: { include: { researchArea: true } } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], take: 100 });
    },
    async listProfessorPosts(actorId: string, publishedOnly = false) {
      await actor(actorId, 'PROFESSOR');
      return db.opportunity.findMany({ where: { professorId: actorId, ...(publishedOnly ? { status: 'PUBLISHED' as const } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100 });
    },
    async createOpportunity(actorId: string, input: unknown) {
      await actor(actorId, 'PROFESSOR');
      const { researchAreaIds, ...fields } = opportunityFields.parse(input);
      return db.opportunity.create({ data: { ...fields, professorId: actorId,
        researchAreas: { create: [...new Set(researchAreaIds)].map(researchAreaId => ({ researchAreaId })) } } });
    },
    async publishOpportunity(actorId: string, opportunityId: string) {
      await actor(actorId, 'PROFESSOR');
      return db.$transaction(async tx => {
        const post = await tx.opportunity.findFirst({ where: { id: id.parse(opportunityId), professorId: actorId }, include: { researchAreas: true } });
        if (!post) throw new DataAccessError('NOT_FOUND', 'Opportunity not found.');
        if (post.status !== 'DRAFT' || !post.description.trim() || !post.duration?.trim()
          || !post.deadline || post.deadline <= new Date() || !post.hoursMin || !post.hoursMax
          || !post.responsibilities.length || !post.goals.length || !post.prerequisites.length || !post.researchAreas.length) {
          throw new DataAccessError('INVALID', 'Complete all required fields and set a future deadline before publishing.');
        }
        const changed = await tx.opportunity.updateMany({ where: { id: post.id, professorId: actorId, status: 'DRAFT' }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
        if (!changed.count) throw new DataAccessError('CONFLICT', 'Opportunity was already changed.');
        return tx.opportunity.findUniqueOrThrow({ where: { id: post.id } });
      });
    },
    async apply(actorId: string, opportunityId: string) {
      await actor(actorId, 'STUDENT');
      try {
        return await db.$transaction(async tx => {
          const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Opportunity" WHERE id = ${id.parse(opportunityId)}::uuid FOR SHARE`;
          if (!rows.length) throw new DataAccessError('NOT_FOUND', 'Opportunity not found.');
          const post = await tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
          if (post.status !== 'PUBLISHED' || !post.deadline || post.deadline <= new Date()) throw new DataAccessError('INVALID', 'Applications are closed.');
          const student = await tx.studentProfile.findUniqueOrThrow({ where: { userId: actorId } });
          return tx.application.create({ data: { studentId: actorId, opportunityId, resumeFileId: student.resumeId } });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DataAccessError('CONFLICT', 'You have already applied.');
        throw error;
      }
    },
    async listStudentApplications(actorId: string) {
      await actor(actorId, 'STUDENT');
      return db.application.findMany({ where: { studentId: actorId }, include: { opportunity: true }, orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }], take: 100 });
    },
    async listApplicants(actorId: string, opportunityId: string) {
      await actor(actorId, 'PROFESSOR');
      const post = await db.opportunity.findFirst({ where: { id: id.parse(opportunityId), professorId: actorId } });
      if (!post) throw new DataAccessError('NOT_FOUND', 'Opportunity not found.');
      return db.application.findMany({ where: { opportunityId }, include: { student: true, resume: true }, orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }], take: 100 });
    },
    async decideApplication(actorId: string, applicationId: string, input: unknown) {
      await actor(actorId, 'PROFESSOR');
      const decision = decisionFields.parse(input);
      const result = await db.application.updateMany({ where: { id: id.parse(applicationId), status: 'PENDING', opportunity: { professorId: actorId } },
        data: { ...decision, decidedById: actorId, decidedAt: new Date() } });
      if (!result.count) throw new DataAccessError('CONFLICT', 'Application is unavailable or has already been decided.');
    },
    async startConversation(actorId: string, otherUserId: string) {
      const user = await actor(actorId);
      const other = await actor(otherUserId);
      if (user.role === other.role) throw new DataAccessError('INVALID', 'Conversations require one student and one professor.');
      const pair = user.role === 'STUDENT' ? { studentId: actorId, professorId: other.id } : { studentId: other.id, professorId: actorId };
      return db.conversation.upsert({ where: { studentId_professorId: pair }, update: {}, create: pair });
    },
    async sendMessage(actorId: string, conversationId: string, body: unknown) {
      await actor(actorId);
      const conversation = await db.conversation.findFirst({ where: { id: id.parse(conversationId), OR: [{ studentId: actorId }, { professorId: actorId }] } });
      if (!conversation) throw new DataAccessError('FORBIDDEN', 'Conversation is unavailable.');
      return db.message.create({ data: { conversationId, senderId: actorId, body: messageBody.parse(body) } });
    },
    async readMessages(actorId: string, conversationId: string) {
      await actor(actorId);
      const conversation = await db.conversation.findFirst({ where: { id: id.parse(conversationId), OR: [{ studentId: actorId }, { professorId: actorId }] } });
      if (!conversation) throw new DataAccessError('FORBIDDEN', 'Conversation is unavailable.');
      // Return the most recent 100 in chronological order. Pagination is future work.
      const messages = await db.message.findMany({ where: { conversationId }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 100 });
      return messages.reverse();
    },
  };
}
