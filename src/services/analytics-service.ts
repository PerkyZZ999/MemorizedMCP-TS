import { AnalyticsRepository } from "../repositories/analytics-repository";
import { MemoryMetricSchema, type MemoryMetricDTO } from "../schemas/analytics";
import type { AnalyticsService } from "./types";

export interface AnalyticsServiceDependencies {
  repository: AnalyticsRepository;
}

export class DefaultAnalyticsService implements AnalyticsService {
  #repository: AnalyticsRepository;

  constructor(deps: AnalyticsServiceDependencies) {
    this.#repository = deps.repository;
  }

  recordMetric(metric: MemoryMetricDTO): void {
    const parsed = MemoryMetricSchema.parse(metric);
    this.#repository.record(parsed);
  }

  listRecentMetrics(limit = 50): MemoryMetricDTO[] {
    const metrics = this.#repository.listRecent(limit);
    return metrics.map((metric) => MemoryMetricSchema.parse(metric));
  }
}

