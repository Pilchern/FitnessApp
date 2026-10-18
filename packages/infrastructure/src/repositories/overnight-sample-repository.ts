import type {
  OvernightMetric,
  OvernightSample,
  OvernightSampleRepository,
} from "@fitness-app/application";
import { z } from "zod";
import { type AppSupabaseClient, throwOnError } from "./shared";

const overnightSampleRowSchema = z.object({
  metric: z.enum(["hrv", "heart_rate", "respiratory_rate", "spo2"]),
  sample_local: z.string(),
  bucket_minutes: z.union([z.literal(0), z.literal(60)]),
  value: z.coerce.number(),
});

/** Upsert batches stay well under PostgREST's request size. */
const UPSERT_CHUNK = 500;

export class SupabaseOvernightSampleRepository implements OvernightSampleRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async upsertMany(userId: string, samples: OvernightSample[]) {
    for (let i = 0; i < samples.length; i += UPSERT_CHUNK) {
      const rows = samples.slice(i, i + UPSERT_CHUNK).map((s) => ({
        user_id: userId,
        metric: s.metric,
        sample_local: s.sampleLocal,
        bucket_minutes: s.bucketMinutes,
        value: s.value,
        deleted_at: null,
      }));
      const response = await this.client
        .from("overnight_samples")
        .upsert(rows, {
          onConflict: "user_id,metric,sample_local,bucket_minutes",
        });
      throwOnError(response.error, "Upsert overnight samples");
    }
  }

  async listBetween(userId: string, fromLocal: string, toLocal: string) {
    const response = await this.client
      .from("overnight_samples")
      .select("metric, sample_local, bucket_minutes, value")
      .eq("user_id", userId)
      .gte("sample_local", fromLocal)
      .lt("sample_local", toLocal)
      .is("deleted_at", null)
      .order("sample_local", { ascending: true })
      .limit(2000);
    throwOnError(response.error, "List overnight samples");

    return (response.data ?? []).map((raw) => {
      const row = overnightSampleRowSchema.parse(raw);
      return {
        metric: row.metric as OvernightMetric,
        // Postgres returns "YYYY-MM-DDTHH:MM:SS" for timestamp without zone.
        sampleLocal: row.sample_local.replace(" ", "T").slice(0, 19),
        bucketMinutes: row.bucket_minutes,
        value: row.value,
      };
    });
  }
}
