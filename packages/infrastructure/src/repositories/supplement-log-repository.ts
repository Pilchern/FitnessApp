import type { SupplementLog } from "@fitness-app/domain";
import type {
  LogSupplementAdherenceInput,
  SupplementLogDateRangeQuery,
  SupplementLogRepository,
} from "@fitness-app/application";
import { z } from "zod";
import { type AppSupabaseClient, requireSingleResult, throwOnError } from "./shared";

const supplementLogRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  supplement_id: z.string().uuid(),
  log_date: z.string(),
  taken: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type SupplementLogRow = z.infer<typeof supplementLogRowSchema>;

export function mapSupplementLogRow(row: SupplementLogRow): SupplementLog {
  return {
    id: row.id,
    userId: row.user_id,
    supplementId: row.supplement_id,
    logDate: row.log_date,
    taken: row.taken,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseSupplementLogRepository implements SupplementLogRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  // Upserts on the (supplement_id, log_date) unique constraint (see
  // 20260715150000_create_supplements_and_supplement_logs.sql), so logging
  // the same supplement + day twice just flips `taken` on the existing row
  // instead of creating a duplicate.
  async logAdherence(input: LogSupplementAdherenceInput) {
    const response = await this.client
      .from("supplement_logs")
      .upsert(
        {
          user_id: input.userId,
          supplement_id: input.supplementId,
          log_date: input.logDate,
          taken: input.taken,
        },
        { onConflict: "supplement_id,log_date" },
      )
      .select("*")
      .single();

    return mapSupplementLogRow(
      supplementLogRowSchema.parse(
        requireSingleResult(response, "Log supplement adherence"),
      ),
    );
  }

  async listByDate(userId: string, logDate: string) {
    const response = await this.client
      .from("supplement_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", logDate)
      .is("deleted_at", null);

    throwOnError(response.error, "List supplement logs by date");

    return supplementLogRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapSupplementLogRow);
  }

  async listByDateRange(query: SupplementLogDateRangeQuery) {
    let request = this.client
      .from("supplement_logs")
      .select("*")
      .eq("user_id", query.userId)
      .is("deleted_at", null)
      .order("log_date", { ascending: false })
      .limit(500);

    if (query.startDate) {
      request = request.gte("log_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("log_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "List supplement logs");

    return supplementLogRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapSupplementLogRow);
  }
}
