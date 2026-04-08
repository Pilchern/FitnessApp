import type { SyncJobRun } from "@fitness-app/domain";
import {
  formatIntegrationDateTime,
  formatSyncRunStatus,
} from "../helpers";

type SyncRunsCardProps = {
  syncRuns: SyncJobRun[];
};

function formatJobType(jobType: string): string {
  const map: Record<string, string> = {
    strava_sync: "Strava sync",
    withings_sync: "Withings sync",
    peloton_sync: "Peloton sync",
    strava_full_sync: "Strava full sync",
    withings_full_sync: "Withings full sync",
  };
  return map[jobType] ?? jobType.replaceAll("_", " ");
}

export function SyncRunsCard({ syncRuns }: SyncRunsCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Sync activity
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Recent syncs</h2>
      </div>

      {syncRuns.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-ink/75">
          No syncs yet. Connect Strava or Withings above to get started.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {syncRuns.map((run) => (
            <article
              key={run.id}
              className="rounded-[1.25rem] border border-ink/10 bg-sand/45 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {formatJobType(run.jobType)}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/55">
                    {formatSyncRunStatus(run.status)}
                  </div>
                </div>
                <div className="text-sm text-ink/70">
                  {formatIntegrationDateTime(run.createdAt)}
                </div>
              </div>

              {run.errorMessage ? (
                <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {run.errorMessage}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
