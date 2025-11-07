import { BaseRepository } from "./base";
import type { MemoryMetricRecord } from "./types";

interface MetricRow {
  timestamp: number;
  query_ms: number;
  cache_hit: number;
  result_count: number;
}

export class AnalyticsRepository extends BaseRepository {
  record(metric: MemoryMetricRecord): void {
    this.db.run(
      `INSERT INTO memory_metrics (timestamp, query_ms, cache_hit, result_count)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(timestamp) DO UPDATE SET
         query_ms = excluded.query_ms,
         cache_hit = excluded.cache_hit,
         result_count = excluded.result_count;`,
      [
        metric.timestamp,
        metric.queryMs,
        metric.cacheHit ? 1 : 0,
        metric.resultCount,
      ],
    );
  }

  listRecent(limit = 50): MemoryMetricRecord[] {
    const rows = this.db.all<MetricRow>(
      `SELECT * FROM memory_metrics
       ORDER BY timestamp DESC
       LIMIT ?;`,
      [limit],
    );

    return rows.map((row) => ({
      timestamp: row.timestamp,
      queryMs: row.query_ms,
      cacheHit: row.cache_hit === 1,
      resultCount: row.result_count,
    }));
  }
}

