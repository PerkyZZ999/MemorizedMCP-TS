import type { Config } from "../config";
import { JobRepository } from "../repositories/job-repository";
import type { VectraAdapter } from "../vector/vectra";
import type { SystemService, SystemServiceStatus } from "./types";

export interface SystemServiceDependencies {
  config: Config;
  vectra: VectraAdapter;
  jobRepository: JobRepository;
}

export class DefaultSystemService implements SystemService {
  #config: Config;
  #vectra: VectraAdapter;
  #jobRepository: JobRepository;

  constructor(deps: SystemServiceDependencies) {
    this.#config = deps.config;
    this.#vectra = deps.vectra;
    this.#jobRepository = deps.jobRepository;
  }

  async status(): Promise<SystemServiceStatus> {
    const [health, counts] = await Promise.all([
      this.#vectra.healthCheck(),
      this.#vectra.stats(),
    ]);

    // Trigger a lazy load to ensure job table accessible (no-op).
    this.#jobRepository.list();

    return {
      env: this.#config.env,
      logLevel: this.#config.logLevel,
      dataRoot: this.#config.dataRoot,
      vectra: {
        ok: health.ok,
        memoryIndex: health.memoryIndex,
        documentIndex: health.documentIndex,
        counts,
      },
    };
  }
}

