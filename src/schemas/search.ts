import { z } from "zod";
import { MemorySearchResultSchema } from "./memory";

export const HybridSearchResultSchema = MemorySearchResultSchema.extend({
  source: z.enum(["vector", "text", "graph"]).default("vector"),
});

export type HybridSearchResult = z.infer<typeof HybridSearchResultSchema>;

