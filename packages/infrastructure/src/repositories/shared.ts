import type {
  CanonicalRecordSource,
  ManualOrImportedRecordSource,
} from "@fitness-app/domain";
import type {
  PostgrestError,
  PostgrestSingleResponse,
  SupabaseClient,
} from "@supabase/supabase-js";

type SourceColumns = {
  source_type: CanonicalRecordSource["sourceType"];
  source_provider: string | null;
  source_external_id: string | null;
  import_batch_id: string | null;
  raw_import_event_id: string | null;
};

export type AppSupabaseClient = SupabaseClient;

export function compactRecord<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export function requireSingleResult<T>(
  response: PostgrestSingleResponse<T>,
  context: string,
) {
  if (response.error || !response.data) {
    throw new Error(
      `${context} failed: ${response.error?.message ?? "No data returned"}`,
    );
  }

  return response.data;
}

export function throwOnError(error: PostgrestError | null, context: string) {
  if (error) {
    throw new Error(`${context} failed: ${error.message}`);
  }
}

export function toSourceColumns(
  source: CanonicalRecordSource | ManualOrImportedRecordSource,
): SourceColumns {
  return {
    source_type: source.sourceType,
    source_provider: source.sourceProvider,
    source_external_id: source.sourceExternalId ?? null,
    import_batch_id: source.importBatchId ?? null,
    raw_import_event_id: source.rawImportEventId ?? null,
  };
}

export function mapManualOrImportedSourceFromRow(row: SourceColumns): ManualOrImportedRecordSource {
  if (row.source_type === "manual") {
    return {
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    };
  }

  return {
    sourceType: "imported",
    sourceProvider: row.source_provider ?? "unknown",
    sourceExternalId: row.source_external_id,
    importBatchId: row.import_batch_id,
    rawImportEventId: row.raw_import_event_id,
  };
}

export function mapCanonicalSourceFromRow(row: SourceColumns): CanonicalRecordSource {
  if (row.source_type === "manual") {
    return {
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    };
  }

  if (row.source_type === "mixed") {
    return {
      sourceType: "mixed",
      sourceProvider: row.source_provider ?? "unknown",
      sourceExternalId: row.source_external_id,
      importBatchId: row.import_batch_id,
      rawImportEventId: row.raw_import_event_id,
    };
  }

  return {
    sourceType: "imported",
    sourceProvider: row.source_provider ?? "unknown",
    sourceExternalId: row.source_external_id,
    importBatchId: row.import_batch_id,
    rawImportEventId: row.raw_import_event_id,
  };
}
