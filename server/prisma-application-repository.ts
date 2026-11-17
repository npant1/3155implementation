import { Prisma, type PrismaClient } from "../generated/prisma/client";
import {
  ApplicationServiceError,
  type ApplicationRecord,
  type ApplicationRepository,
} from "./application-service";

export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findStudentProfile(userId: string) {
    return this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
  }

  async findOpportunity(id: string) {
    return this.prisma.researchOpportunity.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
  }

  async createApplication(input: {
    studentId: string;
    opportunityId: string;
  }): Promise<ApplicationRecord> {
    try {
      return await this.prisma.application.create({
        data: input,
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApplicationServiceError(
          "APPLICATION_ALREADY_EXISTS",
          "An application for this opportunity already exists.",
        );
      }

      throw error;
    }
  }
}
