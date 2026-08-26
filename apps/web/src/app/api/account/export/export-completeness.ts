/**
 * Row caps that apply to the personal-data export, plus the payload metadata
 * that tells the user when one of them actually bit.
 *
 * Every `listByDateRange` repository applies `DEFAULT_DATE_RANGE_QUERY_LIMIT`
 * (500) when the caller doesn't pass a `limit`, so the export used to hand
 * back the 500 most recent rows per table with nothing in the payload saying
 * so. The export now asks for the largest page the shared
 * `dateRangeQuerySchema` allows, and — because that ceiling still exists —
 * reports any section that came back at its cap instead of staying silent.
 *
 * Lives in its own module rather than in `route.ts` because a Next.js route
 * file may only export route handlers and route config; any other export
 * fails the generated route type check at build time.
 */

/**
 * Ceiling accepted by `dateRangeQuerySchema.limit` (TD-016). Asking for more
 * than this throws in validation, so it is the most a single export query can
 * return per section.
 */
export const EXPORT_DATE_RANGE_LIMIT = 2000;

/**
 * `SupabaseInsightRepository.listActive()` hardcodes `.limit(50)` and takes no
 * caller-supplied limit, so the insights section can only ever carry 50 rows
 * until that repository grows a `limit` parameter of its own.
 */
export const EXPORT_INSIGHT_LIMIT = 50;

export type ExportSectionRowCount = {
  /** Key of this section in the export payload. */
  section: string;
  rowCount: number;
  limit: number;
};

export type ExportTruncatedSection = {
  section: string;
  returnedRows: number;
  limit: number;
};

export type ExportCompleteness = {
  /** True when no section came back at its row cap. */
  complete: boolean;
  truncatedSections: ExportTruncatedSection[];
  note: string | null;
};

const TRUNCATION_NOTE =
  "Some sections hit a per-query row cap and contain only the most recent rows " +
  "(newest first); older rows in those sections are missing. Request the " +
  "remainder from support before treating this file as a complete copy of your data.";

/**
 * A section that came back with exactly as many rows as its cap allows is
 * indistinguishable from one that was cut off, so it is reported as
 * truncated. That over-reports at most one boundary case (a user with exactly
 * `limit` rows) and never under-reports a genuinely incomplete export.
 */
export function summarizeExportCompleteness(
  sections: ExportSectionRowCount[],
): ExportCompleteness {
  const truncatedSections = sections
    .filter((section) => section.rowCount >= section.limit)
    .map((section) => ({
      section: section.section,
      returnedRows: section.rowCount,
      limit: section.limit,
    }));

  return {
    complete: truncatedSections.length === 0,
    truncatedSections,
    note: truncatedSections.length === 0 ? null : TRUNCATION_NOTE,
  };
}
