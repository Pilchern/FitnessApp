import {
  INSIGHT_RUN_STATE_TYPE,
  type InsightRepository,
  type InsightRunState,
  type PersistedInsight,
  type UpsertInsightInput,
} from "@fitness-app/application";
import { z } from "zod";
import { type AppSupabaseClient, throwOnError } from "./shared";

const runStateSchema = z.object({
  lastRunAt: z.string().nullable().default(null),
  lastAiAttemptAt: z.string().nullable().default(null),
  lastAiOutcome: z.enum(["succeeded", "failed"]).nullable().default(null),
  consecutiveAiFailures: z.number().int().min(0).default(0),
});

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

function keyOf(insight: {
  userId: string;
  insightType: string;
  insightDate: string;
}) {
  return `${insight.userId}:${insight.insightType}:${insight.insightDate}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

/** JSON with object keys sorted, so jsonb's key reordering isn't seen as a change. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Pairs each incoming insight with its stored active row and keeps the pairs
 * whose title, body or evidence differ. Rows that are dismissed or archived
 * are never refreshed, and unchanged rows are skipped so a dashboard reload
 * doesn't rewrite every insight.
 */
export function planInsightRefreshes(
  incoming: UpsertInsightInput[],
  existing: PersistedInsight[],
): Array<{ current: PersistedInsight; next: UpsertInsightInput }> {
  const activeByKey = new Map(
    existing
      .filter((row) => row.status === "active" && row.deletedAt === null)
      .map((row) => [keyOf(row), row]),
  );

  return incoming.flatMap((next) => {
    const current = activeByKey.get(keyOf(next));
    if (!current) {
      return [];
    }
    const changed =
      current.title !== next.title ||
      current.body !== next.body ||
      stableStringify(current.evidence) !== stableStringify(next.evidence);
    return changed ? [{ current, next }] : [];
  });
}

export class SupabaseInsightRepository implements InsightRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async upsertMany(
    insights: UpsertInsightInput[],
  ): Promise<PersistedInsight[]> {
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

    // Step 1, insert. ignoreDuplicates: true skips existing keys, so status
    // (the user's dismiss/archive) is never overwritten. A merge upsert can't
    // be used here: it would SET every payload column, status included, and
    // status is NOT NULL with no default so it can't be left out.
    const response = await this.client
      .from("insights")
      .upsert(rows, {
        onConflict: "user_id,insight_type,insight_date",
        ignoreDuplicates: true,
      })
      .select("*");

    throwOnError(response.error, "Upsert insights");

    const inserted = insightRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapRow);

    // Step 2, refresh. Rows that already existed keep their original text
    // after step 1; update the content columns of the active ones whose text
    // or numbers changed, so the card shows this run's values.
    const insertedKeys = new Set(inserted.map(keyOf));
    const existingInputs = insights.filter(
      (insight) => !insertedKeys.has(keyOf(insight)),
    );
    if (existingInputs.length === 0) {
      return inserted;
    }

    const existingResponse = await this.client
      .from("insights")
      .select("*")
      .in("user_id", unique(existingInputs.map((i) => i.userId)))
      .in("insight_type", unique(existingInputs.map((i) => i.insightType)))
      .in("insight_date", unique(existingInputs.map((i) => i.insightDate)))
      .eq("status", "active")
      .is("deleted_at", null);

    throwOnError(existingResponse.error, "Load existing insights");

    const existing = insightRowSchema
      .array()
      .parse(existingResponse.data ?? [])
      .map(mapRow);
    const refreshes = planInsightRefreshes(existingInputs, existing);

    const refreshed = await Promise.all(
      refreshes.map(async ({ current, next }) => {
        const updateResponse = await this.client
          .from("insights")
          .update({
            title: next.title,
            body: next.body,
            evidence: next.evidence,
          })
          .eq("id", current.id)
          .eq("user_id", current.userId)
          .eq("status", "active");

        throwOnError(updateResponse.error, "Refresh insight");

        return {
          ...current,
          title: next.title,
          body: next.body,
          evidence: next.evidence,
        };
      }),
    );

    return [...inserted, ...refreshed];
  }

  async retireRuleInsights(ids: string[], userId: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    // deleted_at stays null: that marks a system retire, as opposed to the
    // user's archive() which also stamps deleted_at.
    const response = await this.client
      .from("insights")
      .update({ status: "archived" })
      .in("id", ids)
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("source_kind", "rule");

    throwOnError(response.error, "Retire rule insights");
  }

  async getRunState(userId: string): Promise<InsightRunState | null> {
    const response = await this.client
      .from("insights")
      .select("evidence")
      .eq("user_id", userId)
      .eq("insight_type", INSIGHT_RUN_STATE_TYPE)
      .order("insight_date", { ascending: false })
      .limit(1);

    throwOnError(response.error, "Load insight run state");

    const row = response.data?.[0];
    if (!row) {
      return null;
    }
    const parsed = runStateSchema.safeParse(row.evidence);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Run state lives in an `insights` row so no migration is needed. It is
   * written as archived (deleted_at null, like a system retire), so listActive,
   * the dashboard, /insights and the export never see it.
   */
  async saveRunState(
    userId: string,
    runDate: string,
    state: InsightRunState,
  ): Promise<void> {
    const response = await this.client.from("insights").upsert(
      {
        user_id: userId,
        insight_type: INSIGHT_RUN_STATE_TYPE,
        insight_date: runDate,
        status: "archived",
        title: "Insight generation state",
        body: "",
        evidence: state,
        source_kind: "rule",
      },
      { onConflict: "user_id,insight_type,insight_date" },
    );

    throwOnError(response.error, "Save insight run state");
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
