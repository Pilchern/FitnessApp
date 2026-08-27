import { describe, expect, it } from "vitest";
import {
  compactRecord,
  mapCanonicalSourceFromRow,
  mapManualOrImportedSourceFromRow,
  requireSingleResult,
  throwOnError,
  toSourceColumns,
} from "./shared";

/**
 * `packages/infrastructure` had no `test` script at all, so `pnpm test`
 * (`pnpm -r --if-present test`) skipped it silently — 21 repositories with no
 * test runner. These cover the helpers every one of them imports.
 */
describe("compactRecord", () => {
  it("drops undefined but writes null through", () => {
    // This distinction is the whole contract. Every repository `update()` is a
    // partial update only because omitted fields arrive as `undefined` and get
    // stripped, while an explicit `null` must reach the database to clear a
    // column. Filtering `null` instead would turn every null-out in the app
    // into a silent no-op.
    expect(
      compactRecord({ kept: 1, cleared: null, absent: undefined }),
    ).toEqual({ kept: 1, cleared: null });
  });

  it("preserves falsy values that are not undefined", () => {
    // 0 and "" are real values a user can set — a truthiness filter would eat
    // them, e.g. zeroing an alcohol count or clearing a note to empty.
    expect(compactRecord({ zero: 0, empty: "", no: false })).toEqual({
      zero: 0,
      empty: "",
      no: false,
    });
  });

  it("returns an empty object when everything is undefined", () => {
    expect(compactRecord({ a: undefined, b: undefined })).toEqual({});
  });

  it("does not mutate its input", () => {
    const input = { a: 1, b: undefined };
    compactRecord(input);
    expect(input).toEqual({ a: 1, b: undefined });
  });
});

describe("toSourceColumns", () => {
  it("maps a manual source to all-null provenance columns", () => {
    expect(
      toSourceColumns({
        sourceType: "manual",
        sourceProvider: null,
        sourceExternalId: null,
        importBatchId: null,
        rawImportEventId: null,
      }),
    ).toEqual({
      source_type: "manual",
      source_provider: null,
      source_external_id: null,
      import_batch_id: null,
      raw_import_event_id: null,
    });
  });

  it("carries every imported provenance field through", () => {
    expect(
      toSourceColumns({
        sourceType: "imported",
        sourceProvider: "withings",
        sourceExternalId: "ext-1",
        importBatchId: "batch-1",
        rawImportEventId: "raw-1",
      }),
    ).toEqual({
      source_type: "imported",
      source_provider: "withings",
      source_external_id: "ext-1",
      import_batch_id: "batch-1",
      raw_import_event_id: "raw-1",
    });
  });
});

describe("mapManualOrImportedSourceFromRow", () => {
  it("round-trips an imported source through toSourceColumns", () => {
    const source = {
      sourceType: "imported" as const,
      sourceProvider: "strava",
      sourceExternalId: "ext-9",
      importBatchId: "batch-9",
      rawImportEventId: "raw-9",
    };

    expect(mapManualOrImportedSourceFromRow(toSourceColumns(source))).toEqual(
      source,
    );
  });

  it("discards provenance columns on a manual row", () => {
    // Deliberate: a manual row has no provider even if the columns hold
    // leftovers. Cross-provider dedup reads sourceProvider, so this must stay
    // null rather than leaking a stale value into that decision.
    expect(
      mapManualOrImportedSourceFromRow({
        source_type: "manual",
        source_provider: "strava",
        source_external_id: "ext-1",
        import_batch_id: "batch-1",
        raw_import_event_id: "raw-1",
      }),
    ).toEqual({
      sourceType: "manual",
      sourceProvider: null,
      sourceExternalId: null,
      importBatchId: null,
      rawImportEventId: null,
    });
  });

  it("falls back to 'unknown' rather than null for a provider-less import", () => {
    const mapped = mapManualOrImportedSourceFromRow({
      source_type: "imported",
      source_provider: null,
      source_external_id: null,
      import_batch_id: null,
      raw_import_event_id: null,
    });

    expect(mapped.sourceType).toBe("imported");
    expect(mapped.sourceProvider).toBe("unknown");
  });
});

describe("mapCanonicalSourceFromRow", () => {
  it("preserves the mixed source type, which the narrower mapper cannot", () => {
    const mapped = mapCanonicalSourceFromRow({
      source_type: "mixed",
      source_provider: "withings",
      source_external_id: "ext-2",
      import_batch_id: null,
      raw_import_event_id: null,
    });

    expect(mapped.sourceType).toBe("mixed");
    expect(mapped.sourceProvider).toBe("withings");
  });

  it("handles manual and imported the same way as the narrower mapper", () => {
    const row = {
      source_type: "imported" as const,
      source_provider: "peloton",
      source_external_id: "ext-3",
      import_batch_id: "b",
      raw_import_event_id: "r",
    };

    expect(mapCanonicalSourceFromRow(row)).toEqual(
      mapManualOrImportedSourceFromRow(row),
    );
  });
});

describe("requireSingleResult", () => {
  it("returns the data when present", () => {
    expect(
      requireSingleResult(
        { data: { id: "x" }, error: null } as never,
        "Load thing",
      ),
    ).toEqual({ id: "x" });
  });

  it("throws with the context and the underlying message on an error", () => {
    expect(() =>
      requireSingleResult(
        { data: null, error: { message: "boom" } } as never,
        "Load thing",
      ),
    ).toThrow("Load thing failed: boom");
  });

  it("throws when there is no error but also no data", () => {
    expect(() =>
      requireSingleResult({ data: null, error: null } as never, "Load thing"),
    ).toThrow("Load thing failed: No data returned");
  });
});

describe("throwOnError", () => {
  it("does nothing when there is no error", () => {
    expect(() => throwOnError(null, "Query")).not.toThrow();
  });

  it("throws with the context prefix", () => {
    expect(() => throwOnError({ message: "bad" } as never, "Query")).toThrow(
      "Query failed: bad",
    );
  });
});
