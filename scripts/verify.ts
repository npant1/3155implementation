import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/db.js';
import { createDataAccess } from '../src/data/index.js';

const db = createDatabase();
try {
  await db.$connect();
  await db.$transaction(async tx => {
    const user = await tx.user.create({ data: { email: `verify-${randomUUID()}@example.test`, role: 'PROFESSOR' } });
    await tx.professorProfile.create({ data: { userId: user.id, displayName: 'Connection verification', researchAreas: [] } });
    const loaded = await tx.professorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    if (loaded.displayName !== 'Connection verification') throw new Error('Readback mismatch.');
    await tx.professorProfile.delete({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });
  const posts = await createDataAccess(db).listPublishedOpportunities();
  console.log(`Database connection, transactional write/read/delete, and shared listing query passed (${posts.length} published listings).`);
} finally { await db.$disconnect(); }
