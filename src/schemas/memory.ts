import { z } from "zod";

export const MemoryLayerSchema = z.enum([
  "stm",
  "ltm",
  "episodic",
  "semantic",
  "documentary",
]);

export const MemoryReferenceSchema = z.object({
  docId: z.string(),
  chunkId: z.string().optional(),
  score: z.number().optional(),
  relation: z.string().optional(),
});

export const MemoryAddInputSchema = z.object({
  content: z.string().min(1),
  layer: MemoryLayerSchema,
  metadata: z.object({}).catchall(z.unknown()).default({}),
  importance: z.number().min(0).max(1).optional(),
  sessionId: z.string().optional(),
  episodeId: z.string().optional(),
  summary: z.string().optional(),
});

export const MemoryRecordSchema = z.object({
  id: z.string(),
  layer: MemoryLayerSchema,
  content: z.string(),
  metadata: z.object({}).catchall(z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number(),
  importance: z.number(),
  sessionId: z.string().nullish(),
  episodeId: z.string().nullish(),
  summary: z.string().nullish(),
  embeddingId: z.string().nullish(),
  references: z.array(MemoryReferenceSchema).optional(),
});

export const MemorySearchRequestSchema = z.object({
  query: z.string().optional(),
  queryVector: z.array(z.number()).optional(),
  topK: z.number().int().min(1).max(100).default(20),
  layers: z.array(MemoryLayerSchema).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  sessionId: z.string().optional(),
  episodeId: z.string().optional(),
  includeReferences: z.boolean().default(true),
});

export const MemorySearchResultSchema = MemoryRecordSchema.extend({
  score: z.number(),
  vectorScore: z.number().optional(),
  textScore: z.number().optional(),
  graphScore: z.number().optional(),
});

// Memory Enhancement Schemas
export const MemoryGetRequestSchema = z.object({
  id: z.string(),
});

export const MemoryGetByEntityRequestSchema = z.object({
  entityId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const MemoryGetByDocumentRequestSchema = z.object({
  docId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export type MemoryLayer = z.infer<typeof MemoryLayerSchema>;
export type MemoryReferenceDTO = z.infer<typeof MemoryReferenceSchema>;
export type MemoryRecordDTO = z.infer<typeof MemoryRecordSchema>;
export type MemoryAddInput = z.infer<typeof MemoryAddInputSchema>;
export type MemorySearchRequest = z.infer<typeof MemorySearchRequestSchema>;
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;
export type MemoryGetRequest = z.infer<typeof MemoryGetRequestSchema>;
export type MemoryGetByEntityRequest = z.infer<typeof MemoryGetByEntityRequestSchema>;
export type MemoryGetByDocumentRequest = z.infer<typeof MemoryGetByDocumentRequestSchema>;

