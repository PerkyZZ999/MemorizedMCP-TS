import cron, { type ScheduledTask } from "node-cron";
import type { AppLogger } from "../logging";
import type { JobRepository } from "../repositories/job-repository";

export interface ScheduledJobDefinition {
  name: string;
  schedule: string;
  description?: string;
  task: () => Promise<void> | void;
}

interface RegisteredJob {
  definition: ScheduledJobDefinition;
  task: ScheduledTask;
}

export class JobScheduler {
  #logger: AppLogger;
  #jobRepository: JobRepository;
  #jobs = new Map<string, RegisteredJob>();

  constructor(logger: AppLogger, jobRepository: JobRepository) {
    this.#logger = logger;
    this.#jobRepository = jobRepository;
  }

  register(definition: ScheduledJobDefinition): void {
    if (this.#jobs.has(definition.name)) {
      throw new Error(`Job "${definition.name}" already registered`);
    }

    const scheduledTask = cron.schedule(
      definition.schedule,
      () => this.#execute(definition),
      { scheduled: false },
    );

    this.#jobs.set(definition.name, {
      definition,
      task: scheduledTask,
    });

    this.#jobRepository.upsert({
      name: definition.name,
      status: "idle",
      metadata: {
        schedule: definition.schedule,
      },
    });

    this.#logger.debug?.(
      {
        job: definition.name,
        schedule: definition.schedule,
      },
      "Registered scheduled job",
    );
  }

  startAll(): void {
    for (const { definition, task } of this.#jobs.values()) {
      if (!task.getStatus().startsWith("scheduled")) {
        task.start();
        this.#logger.info(
          {
            job: definition.name,
            schedule: definition.schedule,
          },
          "Started scheduled job",
        );
      }
    }
  }

  stopAll(): void {
    for (const { definition, task } of this.#jobs.values()) {
      if (task.getStatus() !== "stopped") {
        task.stop();
        this.#logger.info(
          { job: definition.name },
          "Stopped scheduled job",
        );
      }
    }
  }

  async runJobNow(name: string): Promise<void> {
    const registered = this.#jobs.get(name);
    if (!registered) {
      throw new Error(`Job "${name}" is not registered`);
    }
    await this.#execute(registered.definition);
  }

  listJobs(): Array<{ name: string; schedule: string }> {
    return Array.from(this.#jobs.values()).map(({ definition }) => ({
      name: definition.name,
      schedule: definition.schedule,
    }));
  }

  async #execute(definition: ScheduledJobDefinition): Promise<void> {
    const start = Date.now();
    this.#logger.info({ job: definition.name }, "Job started");

    try {
      await Promise.resolve(definition.task());
      const durationMs = Date.now() - start;
      this.#jobRepository.markRun(definition.name, "succeeded", {
        durationMs,
      });
      this.#logger.info(
        {
          job: definition.name,
          durationMs,
        },
        "Job completed",
      );
    } catch (error) {
      const durationMs = Date.now() - start;
      this.#jobRepository.markRun(definition.name, "failed", {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      this.#logger.error(
        {
          job: definition.name,
          durationMs,
          err: error,
        },
        "Job failed",
      );
    }
  }
}

