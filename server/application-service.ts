export type OpportunityStatus = "OPEN" | "CLOSED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface ApplicationRecord {
  id: string;
  status: ApplicationStatus;
  submittedAt: Date;
}

export interface ApplicationRepository {
  findStudentProfile(userId: string): Promise<{ userId: string } | null>;
  findOpportunity(id: string): Promise<{ id: string; status: OpportunityStatus } | null>;
  createApplication(input: {
    studentId: string;
    opportunityId: string;
  }): Promise<ApplicationRecord>;
}

export type ApplicationErrorCode =
  | "INVALID_INPUT"
  | "STUDENT_PROFILE_NOT_FOUND"
  | "OPPORTUNITY_UNAVAILABLE"
  | "APPLICATION_ALREADY_EXISTS";

export class ApplicationServiceError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationServiceError";
  }
}

export class ApplicationService {
  constructor(private readonly repository: ApplicationRepository) {}

  async apply(studentId: string, opportunityId: string): Promise<ApplicationRecord> {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(studentId) || !uuidPattern.test(opportunityId)) {
      throw new ApplicationServiceError(
        "INVALID_INPUT",
        "A valid student identity and opportunity ID are required.",
      );
    }

    const student = await this.repository.findStudentProfile(studentId);
    if (!student) {
      throw new ApplicationServiceError(
        "STUDENT_PROFILE_NOT_FOUND",
        "A student profile is required before applying.",
      );
    }

    const opportunity = await this.repository.findOpportunity(opportunityId);
    if (!opportunity || opportunity.status !== "OPEN") {
      throw new ApplicationServiceError(
        "OPPORTUNITY_UNAVAILABLE",
        "The opportunity is missing or closed.",
      );
    }

    return this.repository.createApplication({ studentId, opportunityId });
  }
}
