import type {
  ImportBatch,
  IntegrationConnection,
  SyncJobRun,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import { uuidSchema } from "../../shared/primitives";

export const integrationStatusQuerySchema = z.object({
  userId: uuidSchema,
  limit: z.number().int().positive().max(25).optional().default(10),
});

export type IntegrationStatusQuery = z.infer<typeof integrationStatusQuerySchema>;

export type IntegrationStatusSnapshot = {
  connections: IntegrationConnection[];
  syncRuns: SyncJobRun[];
  importBatches: ImportBatch[];
};

export interface IntegrationStatusRepository {
  listConnections(userId: UserId): Promise<IntegrationConnection[]>;
  listRecentSyncRuns(userId: UserId, limit: number): Promise<SyncJobRun[]>;
  listRecentImportBatches(userId: UserId, limit: number): Promise<ImportBatch[]>;
}

export class IntegrationStatusService {
  constructor(private readonly repository: IntegrationStatusRepository) {}

  async getSnapshot(input: unknown): Promise<IntegrationStatusSnapshot> {
    const query = integrationStatusQuerySchema.parse(input);
    const [connections, syncRuns, importBatches] = await Promise.all([
      this.repository.listConnections(query.userId),
      this.repository.listRecentSyncRuns(query.userId, query.limit),
      this.repository.listRecentImportBatches(query.userId, query.limit),
    ]);

    return {
      connections,
      syncRuns,
      importBatches,
    };
  }
}
