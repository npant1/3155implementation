import { describe, expect, it, vi } from "vitest";
import {
  ApplicationService,
  ApplicationServiceError,
  type ApplicationRepository,
} from "./application-service";

const studentId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";

function createRepository(
  overrides: Partial<ApplicationRepository> = {},
): ApplicationRepository {
  return {
    findStudentProfile: vi.fn(async (userId) => ({ userId })),
    findOpportunity: vi.fn(async (id) => ({ id, status: "OPEN" as const })),
    createApplication: vi.fn(async () => ({
      id: "application-id",
      status: "PENDING" as const,
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
    ...overrides,
  };
}

describe("ApplicationService", () => {
  it("creates an application for an existing student and open opportunity", async () => {
    const repository = createRepository();
    const service = new ApplicationService(repository);

    await expect(service.apply(studentId, opportunityId)).resolves.toMatchObject({
      id: "application-id",
      status: "PENDING",
    });
    expect(repository.createApplication).toHaveBeenCalledWith({
      studentId,
      opportunityId,
    });
  });

  it("rejects a missing student profile before writing", async () => {
    const repository = createRepository({
      findStudentProfile: vi.fn(async () => null),
    });
    const service = new ApplicationService(repository);

    await expect(service.apply(studentId, opportunityId)).rejects.toMatchObject({
      code: "STUDENT_PROFILE_NOT_FOUND",
    });
    expect(repository.createApplication).not.toHaveBeenCalled();
  });

  it("rejects a missing or closed opportunity before writing", async () => {
    const repository = createRepository({
      findOpportunity: vi.fn(async () => ({
        id: "opportunity-id",
        status: "CLOSED" as const,
      })),
    });
    const service = new ApplicationService(repository);

    await expect(service.apply(studentId, opportunityId)).rejects.toMatchObject({
      code: "OPPORTUNITY_UNAVAILABLE",
    });
    expect(repository.createApplication).not.toHaveBeenCalled();
  });

  it("rejects an empty identity without querying the repository", async () => {
    const repository = createRepository();
    const service = new ApplicationService(repository);

    await expect(service.apply("not-a-uuid", opportunityId)).rejects.toBeInstanceOf(ApplicationServiceError);
    expect(repository.findStudentProfile).not.toHaveBeenCalled();
  });

  it("surfaces repository errors instead of reporting a false success", async () => {
    const databaseError = new Error("database unavailable");
    const repository = createRepository({
      createApplication: vi.fn(async () => {
        throw databaseError;
      }),
    });
    const service = new ApplicationService(repository);

    await expect(service.apply(studentId, opportunityId)).rejects.toBe(databaseError);
  });
});
