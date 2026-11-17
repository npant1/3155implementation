import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaApplicationRepository } from "../server/prisma-application-repository";
import { ApplicationService } from "../server/application-service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("PostgreSQL application persistence", () => {
  if (!databaseUrl) {
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const suffix = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const professorId = crypto.randomUUID();
  let opportunityId: string;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: studentId,
        email: `student-${suffix}@example.test`,
        passwordHash: "test-only-hash",
        role: "STUDENT",
        studentProfile: {
          create: {
            fullName: "Test Student",
          },
        },
      },
    });
    await prisma.user.create({
      data: {
        id: professorId,
        email: `professor-${suffix}@example.test`,
        passwordHash: "test-only-hash",
        role: "PROFESSOR",
        professorProfile: {
          create: {
            fullName: "Test Professor",
          },
        },
      },
    });
    const opportunity = await prisma.researchOpportunity.create({
      data: {
        professorId,
        title: "Test opportunity",
        description: "Isolated integration-test record",
        areaOfStudy: "Computer Science",
      },
    });
    opportunityId = opportunity.id;
  });

  afterAll(async () => {
    if (opportunityId) {
      await prisma.application.deleteMany({ where: { opportunityId } });
      await prisma.researchOpportunity.delete({ where: { id: opportunityId } });
    }
    await prisma.user.deleteMany({
      where: {
        id: { in: [studentId, professorId] },
      },
    });
    await prisma.$disconnect();
  });

  it("writes and reads back one application and rejects a duplicate", async () => {
    const service = new ApplicationService(new PrismaApplicationRepository(prisma));
    const saved = await service.apply(studentId, opportunityId);
    const readBack = await prisma.application.findUnique({
      where: { studentId_opportunityId: { studentId, opportunityId } },
    });

    expect(readBack).toMatchObject({
      id: saved.id,
      studentId,
      opportunityId,
      status: "PENDING",
    });
    await expect(service.apply(studentId, opportunityId)).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_EXISTS",
    });
  });
});
