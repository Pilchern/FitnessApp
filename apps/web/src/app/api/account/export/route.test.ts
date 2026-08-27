import { describe, expect, it } from "vitest";
import {
  EXPORT_DATE_RANGE_LIMIT,
  EXPORT_INSIGHT_LIMIT,
  summarizeExportCompleteness,
} from "./export-completeness";

// The route handler itself can't be imported here: it pulls in
// `@/lib/server/services` and `@fitness-app/application`, and apps/web has no
// vitest config wiring up those tsconfig path aliases (the two existing route
// tests under src/app/api likewise test the route's supporting modules with
// relative imports). The completeness metadata is the part with real logic,
// so that is what is covered.

describe("summarizeExportCompleteness", () => {
  it("reports a complete export when no section reached its cap", () => {
    const result = summarizeExportCompleteness([
      { section: "bodyMetrics", rowCount: 812, limit: EXPORT_DATE_RANGE_LIMIT },
      { section: "insights", rowCount: 12, limit: EXPORT_INSIGHT_LIMIT },
    ]);

    expect(result).toEqual({
      complete: true,
      truncatedSections: [],
      note: null,
    });
  });

  it("treats an export with no capped sections as complete", () => {
    expect(summarizeExportCompleteness([])).toEqual({
      complete: true,
      truncatedSections: [],
      note: null,
    });
  });

  it("flags a date-range section that came back at the schema ceiling", () => {
    const result = summarizeExportCompleteness([
      { section: "bodyMetrics", rowCount: 40, limit: EXPORT_DATE_RANGE_LIMIT },
      {
        section: "strengthSessions",
        rowCount: EXPORT_DATE_RANGE_LIMIT,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
    ]);

    expect(result.complete).toBe(false);
    expect(result.truncatedSections).toEqual([
      {
        section: "strengthSessions",
        returnedRows: EXPORT_DATE_RANGE_LIMIT,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
    ]);
    expect(result.note).toContain("most recent rows");
  });

  it("flags the insights section at its own, much lower cap", () => {
    const result = summarizeExportCompleteness([
      {
        section: "insights",
        rowCount: EXPORT_INSIGHT_LIMIT,
        limit: EXPORT_INSIGHT_LIMIT,
      },
    ]);

    expect(result.complete).toBe(false);
    expect(result.truncatedSections).toEqual([
      {
        section: "insights",
        returnedRows: EXPORT_INSIGHT_LIMIT,
        limit: EXPORT_INSIGHT_LIMIT,
      },
    ]);
  });

  it("lists every truncated section, in the order given", () => {
    const result = summarizeExportCompleteness([
      {
        section: "nutritionLogs",
        rowCount: EXPORT_DATE_RANGE_LIMIT,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
      {
        section: "journalEntries",
        rowCount: 3,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
      {
        section: "supplementLogs",
        rowCount: EXPORT_DATE_RANGE_LIMIT,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
    ]);

    expect(result.truncatedSections.map((section) => section.section)).toEqual([
      "nutritionLogs",
      "supplementLogs",
    ]);
  });

  it("does not flag a section one row below its cap", () => {
    const result = summarizeExportCompleteness([
      {
        section: "cardioSessions",
        rowCount: EXPORT_DATE_RANGE_LIMIT - 1,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
    ]);

    expect(result.complete).toBe(true);
  });

  it("flags a section that somehow exceeded its cap", () => {
    const result = summarizeExportCompleteness([
      {
        section: "recoveryCheckins",
        rowCount: EXPORT_DATE_RANGE_LIMIT + 5,
        limit: EXPORT_DATE_RANGE_LIMIT,
      },
    ]);

    expect(result.complete).toBe(false);
    expect(result.truncatedSections[0]?.returnedRows).toBe(
      EXPORT_DATE_RANGE_LIMIT + 5,
    );
  });

  it("keeps the caps in sync with the limits the data layer enforces", () => {
    // EXPORT_DATE_RANGE_LIMIT must stay equal to the `.max()` on
    // `dateRangeQuerySchema.limit` in packages/application/src/shared/
    // primitives.ts (a larger value would throw in validation), and
    // EXPORT_INSIGHT_LIMIT to the hardcoded `.limit(50)` in
    // SupabaseInsightRepository.listActive(). They can't be imported here
    // (unresolvable path aliases), so they are pinned instead.
    expect(EXPORT_DATE_RANGE_LIMIT).toBe(2000);
    expect(EXPORT_INSIGHT_LIMIT).toBe(50);
  });
});
