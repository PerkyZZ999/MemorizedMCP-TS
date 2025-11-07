import { createHash, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { BunFile } from "bun";
import { DocumentChunkRepository } from "../repositories/document-chunk-repository";
import { DocumentRepository } from "../repositories/document-repository";
import { KnowledgeGraphRepository } from "../repositories/knowledge-graph-repository";
import type { VectraAdapter } from "../vector/vectra";
import {
  DocumentIngestionRequestSchema,
  DocumentIngestionResultSchema,
  DocumentRecordSchema,
  type DocumentIngestionRequest,
  type DocumentIngestionResult,
  type DocumentRecordDTO,
  type DocumentChunkDTO,
} from "../schemas/document";
import { ExtractedEntitySchema } from "../schemas/knowledge";
import type {
  EmbeddingProvider,
  EntityExtractor,
  SummaryGenerator,
  TextSplitter,
  TextSplitterChunk,
  DocumentService,
} from "./types";

export interface DocumentServiceDependencies {
  documentRepository: DocumentRepository;
  chunkRepository: DocumentChunkRepository;
  knowledgeRepository: KnowledgeGraphRepository;
  vectra: VectraAdapter;
  embeddings: EmbeddingProvider;
  textSplitter: TextSplitter;
  summaryGenerator?: SummaryGenerator;
  entityExtractor?: EntityExtractor;
}

export class DefaultDocumentService implements DocumentService {
  #documentRepository: DocumentRepository;
  #chunkRepository: DocumentChunkRepository;
  #knowledgeRepository: KnowledgeGraphRepository;
  #vectra: VectraAdapter;
  #embeddings: EmbeddingProvider;
  #textSplitter: TextSplitter;
  #summaryGenerator?: SummaryGenerator;
  #entityExtractor?: EntityExtractor;

  constructor(deps: DocumentServiceDependencies) {
    this.#documentRepository = deps.documentRepository;
    this.#chunkRepository = deps.chunkRepository;
    this.#knowledgeRepository = deps.knowledgeRepository;
    this.#vectra = deps.vectra;
    this.#embeddings = deps.embeddings;
    this.#textSplitter = deps.textSplitter;
    this.#summaryGenerator = deps.summaryGenerator;
    this.#entityExtractor = deps.entityExtractor;
  }

  async ingest(request: DocumentIngestionRequest): Promise<DocumentIngestionResult> {
    const parsed = DocumentIngestionRequestSchema.parse(request);
    const { options } = parsed;

    const { text, sizeBytes, sourcePath } = await this.#loadContent(parsed);
    const hash = parsed.hashOverride ?? this.#hashContent(text);

    const existing = this.#documentRepository.findByHash(hash);
    if (existing) {
      return DocumentIngestionResultSchema.parse({
        document: DocumentRecordSchema.parse({
          ...existing,
          chunks: this.#chunkRepository.listByDocument(existing.id),
        }),
        chunkCount: this.#chunkRepository.listByDocument(existing.id).length,
      });
    }

    const now = Date.now();
    const document = this.#documentRepository.create({
      hash,
      sourcePath,
      mime: parsed.mime,
      title: parsed.metadata?.title as string | undefined,
      metadata: parsed.metadata ?? {},
      ingestedAt: now,
      sizeBytes,
    });

    const chunks = this.#textSplitter.split(text, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    });

    const embeddings = await this.#embeddings.embed(chunks.map((chunk) => chunk.text));
    const summaries = await this.#generateSummaries(chunks, options.generateSummary);

    const chunkRecords: DocumentChunkDTO[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]!;
      const embeddingVector = embeddings[index]!;
      const summary = summaries[index];

      const chunkId = randomUUID();

      const record = this.#chunkRepository.insert({
        id: chunkId,
        docId: document.id,
        content: chunk.text,
        positionStart: chunk.start,
        positionEnd: chunk.end,
        page: undefined,
        summary,
        embeddingId: chunkId,
        metadata: {
          order: index,
        },
      });

      await this.#vectra.upsertDocumentVector({
        chunkId,
        docId: document.id,
        vector: embeddingVector,
        positionStart: chunk.start,
        positionEnd: chunk.end,
      });

      chunkRecords.push(record);
    }

    let recordedEntities: string[] | undefined;
    if (options.detectEntities && this.#entityExtractor) {
      const entities = await this.#entityExtractor.extract(text);
      const parsedEntities = entities.map((entity) => ExtractedEntitySchema.parse(entity));

      for (const entity of parsedEntities) {
        this.#knowledgeRepository.upsertEntity({
          name: entity.name,
          type: entity.type,
          tags: [],
        });
      }

      recordedEntities = parsedEntities.map((entity) => entity.name);
    }

    const documentResult: DocumentRecordDTO = DocumentRecordSchema.parse({
      ...document,
      chunks: chunkRecords,
    });

    return DocumentIngestionResultSchema.parse({
      document: documentResult,
      chunkCount: chunkRecords.length,
      entities: recordedEntities,
    });
  }

  async getDocument(id: string): Promise<DocumentRecordDTO | undefined> {
    const record = this.#documentRepository.findById(id);
    if (!record) {
      return undefined;
    }

    const chunks = this.#chunkRepository.listByDocument(id);
    return DocumentRecordSchema.parse({
      ...record,
      chunks,
    });
  }

  async listDocuments(limit = 50, offset = 0): Promise<DocumentRecordDTO[]> {
    const records = this.#documentRepository.list(limit, offset);
    return records.map((record) =>
      DocumentRecordSchema.parse({
        ...record,
        chunks: this.#chunkRepository.listByDocument(record.id),
      }),
    );
  }

  async #loadContent(request: DocumentIngestionRequest) {
    if (request.content) {
      const sizeBytes = Buffer.byteLength(request.content, "utf8");
      return { text: request.content, sizeBytes, sourcePath: request.path };
    }

    if (!request.path) {
      throw new Error("Either content or path must be provided");
    }

    const file = Bun.file(request.path);
    const text = await this.#readFileText(file, request.mime ?? this.#inferMime(request.path));
    const stats = await stat(request.path);

    return {
      text,
      sizeBytes: stats.size,
      sourcePath: request.path,
    };
  }

  async #readFileText(file: BunFile, mime?: string): Promise<string> {
    if ((mime ?? "").includes("pdf") || file.name.endsWith(".pdf")) {
      // TODO: integrate full unpdf parsing. For now, treat as plain text fallback.
    }
    return file.text();
  }

  #inferMime(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") {
      return "application/pdf";
    }
    if (ext === ".txt") {
      return "text/plain";
    }
    if (ext === ".md") {
      return "text/markdown";
    }
    return undefined;
  }

  #hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  async #generateSummaries(
    chunks: TextSplitterChunk[],
    enabled: boolean,
  ): Promise<Array<string | undefined>> {
    if (!enabled) {
      return chunks.map(() => undefined);
    }

    if (!this.#summaryGenerator) {
      return chunks.map((chunk) => this.#fallbackSummary(chunk.text));
    }

    const summaries: Array<string | undefined> = [];
    for (const chunk of chunks) {
      summaries.push(await this.#summaryGenerator.summarize(chunk.text));
    }
    return summaries;
  }

  #fallbackSummary(text: string): string {
    const normalized = text.trim().replace(/\s+/g, " ");
    return normalized.slice(0, 240);
  }
}

export class SlidingWindowTextSplitter implements TextSplitter {
  split(
    text: string,
    options: { chunkSize: number; chunkOverlap: number },
  ): TextSplitterChunk[] {
    const { chunkSize, chunkOverlap } = options;
    if (chunkOverlap >= chunkSize) {
      throw new Error("chunkOverlap must be smaller than chunkSize");
    }

    const chunks: TextSplitterChunk[] = [];
    let start = 0;
    const length = text.length;

    while (start < length) {
      const end = Math.min(start + chunkSize, length);
      const chunkText = text.slice(start, end);
      chunks.push({ text: chunkText, start, end });
      if (end === length) {
        break;
      }
      start = end - chunkOverlap;
    }

    return chunks;
  }
}

