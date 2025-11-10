import path from "node:path";
import { loadConfig, type Config } from "./config";
import { createLogger, type AppLogger } from "./logging";
import { applyMigrations } from "./database/migrations";
import { createSQLiteClient, type SQLiteClient } from "./database/sqlite";
import { VectraAdapter } from "./vector/vectra";
import { DocumentRepository } from "./repositories/document-repository";
import { DocumentChunkRepository } from "./repositories/document-chunk-repository";
import { MemoryRepository } from "./repositories/memory-repository";
import { KnowledgeGraphRepository } from "./repositories/knowledge-graph-repository";
import { TagRepository } from "./repositories/tag-repository";
import { AnalyticsRepository } from "./repositories/analytics-repository";
import { JobRepository } from "./repositories/job-repository";
import {
  DefaultDocumentService,
  SlidingWindowTextSplitter,
} from "./services/document-service";
import { DefaultMemoryService } from "./services/memory-service";
import {
  DefaultKnowledgeGraphService,
  CompromiseEntityExtractor,
} from "./services/knowledge-graph-service";
import { DefaultSearchService } from "./services/search-service";
import { DefaultAnalyticsService } from "./services/analytics-service";
import { DefaultSystemService } from "./services/system-service";
import { TransformersEmbeddingProvider } from "./services/embedding";
import type { ServiceRegistry } from "./services/types";

export interface RepositoryRegistry {
  document: DocumentRepository;
  documentChunks: DocumentChunkRepository;
  memory: MemoryRepository;
  knowledgeGraph: KnowledgeGraphRepository;
  tags: TagRepository;
  analytics: AnalyticsRepository;
  jobs: JobRepository;
}

export interface AppContainer {
  config: Config;
  logger: AppLogger;
  sqlite: SQLiteClient;
  vectra: VectraAdapter;
  repositories: RepositoryRegistry;
  services: ServiceRegistry;
  shutdown: () => Promise<void>;
}

export interface CreateContainerOptions {
  config?: Config;
  logger?: AppLogger;
}

export async function createAppContainer(
  options: CreateContainerOptions = {},
): Promise<AppContainer> {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger(config);

  const sqlite = createSQLiteClient({
    filepath: config.sqlite.url,
  });

  const migrationsDir = path.resolve(process.cwd(), "sql", "migrations");
  await applyMigrations(sqlite, migrationsDir);

  const vectra = new VectraAdapter({
    dataRoot: config.dataRoot,
    memoryCollection: config.vectra.memoryCollection,
    documentCollection: config.vectra.documentCollection,
  });
  await vectra.initialize();

  const documentRepository = new DocumentRepository(sqlite);
  const documentChunkRepository = new DocumentChunkRepository(sqlite);
  const memoryRepository = new MemoryRepository(sqlite);
  const knowledgeRepository = new KnowledgeGraphRepository(sqlite);
  const tagRepository = new TagRepository(sqlite);
  const analyticsRepository = new AnalyticsRepository(sqlite);
  const jobRepository = new JobRepository(sqlite);

  const embeddings = new TransformersEmbeddingProvider(config.transformer.model);
  const textSplitter = new SlidingWindowTextSplitter();
  const entityExtractor = new CompromiseEntityExtractor();

  const searchService = new DefaultSearchService({
    memoryRepository,
    sqlite,
    vectra,
  });

  const documentService = new DefaultDocumentService({
    documentRepository,
    chunkRepository: documentChunkRepository,
    knowledgeRepository,
    vectra,
    embeddings,
    textSplitter,
    entityExtractor,
    memoryRepository,
  });

  const memoryService = new DefaultMemoryService({
    memoryRepository,
    vectra,
    embeddings,
    searchService,
    knowledgeRepository,
  });

  const knowledgeService = new DefaultKnowledgeGraphService({
    repository: knowledgeRepository,
    documentRepository,
    memoryRepository,
    documentChunkRepository,
    entityExtractor,
  });

  const analyticsService = new DefaultAnalyticsService({
    repository: analyticsRepository,
  });

  const systemService = new DefaultSystemService({
    config,
    vectra,
    jobRepository,
  });

  const services: ServiceRegistry = {
    document: documentService,
    memory: memoryService,
    knowledge: knowledgeService,
    search: searchService,
    analytics: analyticsService,
    system: systemService,
  };

  const repositories: RepositoryRegistry = {
    document: documentRepository,
    documentChunks: documentChunkRepository,
    memory: memoryRepository,
    knowledgeGraph: knowledgeRepository,
    tags: tagRepository,
    analytics: analyticsRepository,
    jobs: jobRepository,
  };

  return {
    config,
    logger,
    sqlite,
    vectra,
    repositories,
    services,
    shutdown: async () => {
      sqlite.close();
    },
  };
}

