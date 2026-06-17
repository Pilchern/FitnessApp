import type {
  InsightRepository,
  PersistedInsight,
  UpsertInsightInput,
} from "@fitness-app/application";
import { z } from "zod";
import { type AppSupabaseClient, throwOnError } from "./shared";

const insightRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  insight_date: z.string(),
  insight_type: z.string(),
  status: z.enum(["active", "dismissed", "archived"]),
  title: z.string(),
  body: z.string(),
  evidence: z.record(z.unknown()).default({}),
  source_kind: z.enum(["rule", "ai"]),
  created_at: z.string(),
  updated_at: z.string(),
  dismissed_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

type InsightRow = z.infer<typeof insightRowSchema>;

function mapRow(row: InsightRow): PersistedInsight {
  return {
    id: row.id,
    userId: row.user_id,
    insightDate: row.insight_date,
    insightType: row.insight_type,
    status: row.status,
    title: row.title,
    body: row.body,
    evidence: row.evidence,
    sourceKind: row.source_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dismissedAt: row.dismissed_at,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseInsightRepository implements InsightRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async upsertMany(insights: UpsertInsightInput[]): Promise<PersistedInsight[]> {
    if (insights.length === 0) {
      return [];
    }

    const rows = insights.map((insight) => ({
      user_id: insight.userId,
      insight_type: insight.insightType,
      insight_date: insight.insightDate,
      title: insight.title,
      body: insight.body,
      evidence: insight.evidence,
      source_kind: insight.sourceKind,
      // status only set on initial insert — ON CONFLICT columns list excludes it so user's
      // dismiss/archive is never overwritten.
      status: "active" as const,
    }));

    // ignoreDuplicates: true — skip on conflict so we never overwrite status (user's
    // dismiss/archive) or any other user-editable field. New rows get inserted; existing
    // rows are left untouched.
    const response = await this.client
      .from("insights")
      .upsert(rows, {
        onConflict: "user_id,insight_type,insight_date",
        ignoreDuplicates: true,
      })
      .select("*");

    throwOnError(response.error, "Upsert insights");

    return insightRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapRow);
  }

  async listActive(userId: string): Promise<PersistedInsight[]> {
    const response = await this.client
      .from("insights")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("insight_date", { ascending: false })
      .limit(50);

    throwOnError(response.error, "List active insights");

    return insightRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapRow);
  }

  async dismiss(id: string, userId: string): Promise<void> {
    const response = await this.client
      .from("insights")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "active");

    throwOnError(response.error, "Dismiss insight");
  }

  async archive(id: string, userId: string): Promise<void> {
    const response = await this.client
      .from("insights")
      .update({
        status: "archived",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    throwOnError(response.error, "Archive insight");
  }
}
