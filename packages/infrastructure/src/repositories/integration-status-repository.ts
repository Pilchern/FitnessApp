import type { IntegrationStatusRepository } from "@fitness-app/application";
import { SupabaseImportBatchRepository } from "./import-batch-repository";
import { SupabaseIntegrationConnectionRepository } from "./integration-connection-repository";
import { type AppSupabaseClient } from "./shared";
import { SupabaseSyncJobRunRepository } from "./sync-job-run-repository";

export class SupabaseIntegrationStatusRepository
  implements IntegrationStatusRepository
{
  private readonly connectionRepository: SupabaseIntegrationConnectionRepository;
  private readonly syncJobRunRepository: SupabaseSyncJobRunRepository;
  private readonly importBatchRepository: SupabaseImportBatchRepository;

  constructor(client: AppSupabaseClient) {
    this.connectionRepository = new SupabaseIntegrationConnectionRepository(client);
    this.syncJobRunRepository = new SupabaseSyncJobRunRepository(client);
    this.importBatchRepository = new SupabaseImportBatchRepository(client);
  }

  listConnections(userId: string) {
    return this.connectionRepository.listConnections(userId);
  }

  listRecentSyncRuns(userId: string, limit: number) {
    return this.syncJobRunRepository.listRecentSyncRuns(userId, limit);
  }

  listRecentImportBatches(userId: string, limit: number) {
    return this.importBatchRepository.listRecentImportBatches(userId, limit);
  }
}
