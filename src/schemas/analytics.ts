import { z } from "zod";

export const MemoryMetricSchema = z.object({
  timestamp: z.number(),
  queryMs: z.number(),
  cacheHit: z.boolean(),
  resultCount: z.number().int().nonnegative(),
});

export type MemoryMetricDTO = z.infer<typeof MemoryMetricSchema>;

