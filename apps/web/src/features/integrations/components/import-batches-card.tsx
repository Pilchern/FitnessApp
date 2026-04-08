import type { ImportBatch } from "@fitness-app/domain";
import {
  formatImportBatchStatus,
  formatIntegrationDateTime,
} from "../helpers";

type ImportBatchesCardProps = {
  importBatches: ImportBatch[];
};

function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    strava: "Strava",
    withings: "Withings",
    peloton: "Peloton",
  };
  return map[provider.toLowerCase()] ?? provider;
}

export function ImportBatchesCard({ importBatches }: ImportBatchesCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Import history
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Recent imports</h2>
      </div>

      {importBatches.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-ink/75">
          Nothing imported yet. Your first sync will appear here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {importBatches.map((batch) => (
            <article
              key={batch.id}
              className="rounded-[1.25rem] border border-ink/10 bg-sand/45 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {providerLabel(batch.provider)} — {formatImportBatchStatus(batch.status)}
                  </div>
                  <div className="mt-1 text-sm text-ink/60">
                    {batch.processedItemCount} of {batch.rawItemCount} imported
                    {batch.failedItemCount > 0 ? ` • ${batch.failedItemCount} failed` : ""}
                  </div>
                </div>
                <div className="text-sm text-ink/70">
                  {formatIntegrationDateTime(batch.createdAt)}
                </div>
              </div>

              {batch.errorSummary ? (
                <div className="mt-3 rounded-[1rem] border border-amber-300/30 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {batch.errorSummary}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
