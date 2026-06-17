import { getIntegrationsPageData } from "../server";
import { AppleHealthConnectionCard } from "./apple-health-connection-card";
import { ImportBatchesCard } from "./import-batches-card";
import { StravaConnectionCard } from "./strava-connection-card";
import { SyncRunsCard } from "./sync-runs-card";
import { WithingsConnectionCard } from "./withings-connection-card";

type IntegrationsScreenProps = {
  status?: string;
  error?: string;
};

export async function IntegrationsScreen({
  status,
  error,
}: IntegrationsScreenProps) {
  const data = await getIntegrationsPageData({ status, error });

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Integrations
        </p>
        <h1 className="mt-3 font-display text-2xl md:text-4xl text-ink">
          Connected apps
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Connect Strava and Withings to automatically import your workouts and
          body measurements. Use the Apple Health webhook to push sleep and
          recovery data from your iPhone each morning. Your manually logged data
          is always kept separate and is never affected by these connections.
        </p>
      </section>

      {data.flashMessage ? (
        <div
          className={`rounded-[1.5rem] border px-5 py-3 text-sm font-medium ${
            data.flashMessage.tone === "error"
              ? "border-ember/20 bg-ember/10 text-ember"
              : "border-pine/20 bg-pine/10 text-pine"
          }`}
        >
          {data.flashMessage.text}
        </div>
      ) : null}

      <StravaConnectionCard
        configured={data.stravaConfigured}
        connection={data.stravaConnection}
      />

      <WithingsConnectionCard
        configured={data.withingsConfigured}
        connection={data.withingsConnection}
      />

      <AppleHealthConnectionCard
        configured={data.appleHealthConfigured}
        connection={data.appleHealthConnection}
        userId={data.userId}
        appUrl={data.appUrl}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SyncRunsCard syncRuns={data.snapshot.syncRuns} />
        <ImportBatchesCard importBatches={data.snapshot.importBatches} />
      </div>
    </div>
  );
}
