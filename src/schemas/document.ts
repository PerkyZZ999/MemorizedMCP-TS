import { z } from "zod";
import { MemoryReferenceSchema } from "./memory";

export const DocumentIngestionOptionsSchema = z.object({
  chunkSize: z.number().int().min(100).max(4000).default(800),
  chunkOverlap: z.number().int().min(0).max(400).default(60),
  generateSummary: z.boolean().default(true),
  detectEntities: z.boolean().default(true),
});

export const DocumentMetadataSchema = z.object({}).catchall(z.unknown());

export const DocumentIngestionRequestSchema = z.object({
  path: z.string().optional(),
  mime: z.string().optional(),
  content: z.string().optional(),
  metadata: DocumentMetadataSchema.optional(),
  hashOverride: z.string().optional(),
  references: z.array(MemoryReferenceSchema).optional(),
  options: DocumentIngestionOptionsSchema.default({}),
}).refine(
  (value) => Boolean(value.path) || Boolean(value.content),
  "Provide either path or content",
);

export const DocumentChunkSchema = z.object({
  id: z.string(),
  docId: z.string(),
  positionStart: z.number(),
  positionEnd: z.number(),
  page: z.number().optional(),
  content: z.string(),
  summary: z.string().optional(),
  embeddingId: z.string().optional(),
  metadata: z.object({}).catchall(z.unknown()),
});

export const DocumentRecordSchema = z.object({
  id: z.string(),
  hash: z.string(),
  sourcePath: z.string().optional(),
  mime: z.string().optional(),
  title: z.string().optional(),
  metadata: DocumentMetadataSchema,
  ingestedAt: z.number(),
  sizeBytes: z.number(),
  chunks: z.array(DocumentChunkSchema).default([]),
});

export const DocumentIngestionResultSchema = z.object({
  document: DocumentRecordSchema,
  chunkCount: z.number().int().min(0),
  entities: z.array(z.string()).optional(),
});

export const DocumentRetrieveRequestSchema = z.object({
  id: z.string(),
});

export const DocumentListRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export type DocumentIngestionOptions = z.infer<typeof DocumentIngestionOptionsSchema>;
export type DocumentIngestionRequest = z.infer<typeof DocumentIngestionRequestSchema>;
export type DocumentChunkDTO = z.infer<typeof DocumentChunkSchema>;
export type DocumentRecordDTO = z.infer<typeof DocumentRecordSchema>;
export type DocumentIngestionResult = z.infer<typeof DocumentIngestionResultSchema>;
export type DocumentRetrieveRequest = z.infer<typeof DocumentRetrieveRequestSchema>;
export type DocumentListRequest = z.infer<typeof DocumentListRequestSchema>;

