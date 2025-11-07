import { describe, expect, it, vi } from "vitest";
import type { JobRepository } from "../src/repositories/job-repository";
import { JobScheduler } from "../src/jobs/scheduler";

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

function createJobRepositoryMock() {
  const upsert = vi.fn().mockImplementation((job) => job);
  const markRun = vi.fn().mockImplementation((name, status, metadata) => ({
    name,
    status,
    metadata,
    lastRun: Date.now(),
  }));

  return {
    repo: { upsert, markRun } as unknown as JobRepository,
    upsert,
    markRun,
  };
}

describe("JobScheduler", () => {
  it("runs a job and records success", async () => {
    const { repo, markRun } = createJobRepositoryMock();
    const scheduler = new JobScheduler(logger, repo);
    const task = vi.fn().mockResolvedValue(undefined);

    scheduler.register({
      name: "job.test",
      schedule: "* * * * *",
      task,
    });

    await scheduler.runJobNow("job.test");

    expect(task).toHaveBeenCalled();
    expect(markRun).toHaveBeenCalledWith(
      "job.test",
      "succeeded",
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it("marks job as failed when an exception is thrown", async () => {
    const { repo, markRun } = createJobRepositoryMock();
    const scheduler = new JobScheduler(logger, repo);
    const error = new Error("Bang!");
    const task = vi.fn().mockRejectedValue(error);

    scheduler.register({
      name: "job.fail",
      schedule: "* * * * *",
      task,
    });

    await scheduler.runJobNow("job.fail");

    expect(task).toHaveBeenCalled();
    expect(markRun).toHaveBeenCalledWith(
      "job.fail",
      "failed",
      expect.objectContaining({
        durationMs: expect.any(Number),
        error: error.message,
      }),
    );
  });
});

