import { z } from "zod";

export const KnowledgeEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  count: z.number().int().nonnegative(),
  firstSeen: z.number(),
  lastSeen: z.number(),
  tags: z.array(z.string()).default([]),
});

export const KnowledgeEdgeSchema = z.object({
  id: z.string(),
  src: z.string(),
  dst: z.string(),
  relation: z.string(),
  weight: z.number().optional(),
  createdAt: z.number(),
  metadata: z.object({}).catchall(z.unknown()),
});

export const KnowledgeListEntitiesRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ExtractedEntitySchema = z.object({
  name: z.string(),
  type: z.string().default("other"),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type KnowledgeEntityDTO = z.infer<typeof KnowledgeEntitySchema>;
export type KnowledgeEdgeDTO = z.infer<typeof KnowledgeEdgeSchema>;
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type KnowledgeListEntitiesRequest = z.infer<typeof KnowledgeListEntitiesRequestSchema>;

