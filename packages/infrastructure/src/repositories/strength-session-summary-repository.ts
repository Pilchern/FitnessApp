import type {
  StrengthSessionDateRangeQuery,
  StrengthSessionSummaryRepository,
} from "@fitness-app/application";
import { type AppSupabaseClient, throwOnError } from "./shared";

export class SupabaseStrengthSessionSummaryRepository
  implements StrengthSessionSummaryRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  async countCompletedByDateRange(query: StrengthSessionDateRangeQuery) {
    let request = this.client
      .from("strength_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", query.userId)
      .is("deleted_at", null);

    if (query.startDate) {
      request = request.gte("session_date", query.startDate);
    }

    if (query.endDate) {
      request = request.lte("session_date", query.endDate);
    }

    const response = await request;
    throwOnError(response.error, "Count strength sessions");
    return response.count ?? 0;
  }
}
