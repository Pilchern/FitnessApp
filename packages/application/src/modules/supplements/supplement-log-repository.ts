import type { SupplementLog, UserId } from "@fitness-app/domain";
import {
  logSupplementAdherenceSchema,
  supplementLogByDateQuerySchema,
  supplementLogDateRangeQuerySchema,
  type LogSupplementAdherenceInput,
  type SupplementLogByDateQuery,
  type SupplementLogDateRangeQuery,
} from "./supplement-schemas";

export interface SupplementLogRepository {
  logAdherence(input: LogSupplementAdherenceInput): Promise<SupplementLog>;
  listByDate(userId: UserId, logDate: string): Promise<SupplementLog[]>;
  listByDateRange(query: SupplementLogDateRangeQuery): Promise<SupplementLog[]>;
}

export class SupplementLogService {
  constructor(private readonly repository: SupplementLogRepository) {}

  /**
   * Logs (or unlogs, when `taken` is false) adherence for one supplement on
   * one date. Upserts on the (supplement_id, log_date) unique constraint so
   * re-submitting the same day's checklist just updates the existing row.
   */
  async logAdherence(input: unknown) {
    return this.repository.logAdherence(
      logSupplementAdherenceSchema.parse(input),
    );
  }

  async listByDate(input: unknown): Promise<SupplementLog[]> {
    const query: SupplementLogByDateQuery =
      supplementLogByDateQuerySchema.parse(input);
    return this.repository.listByDate(query.userId, query.logDate);
  }

  async listByDateRange(input: unknown) {
    return this.repository.listByDateRange(
      supplementLogDateRangeQuerySchema.parse(input),
    );
  }
}
