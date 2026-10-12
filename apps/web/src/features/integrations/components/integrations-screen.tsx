import { getIntegrationsPageData } from "../server";
import { AppleHealthConnectionCard } from "./apple-health-connection-card";
import { ImportBatchesCard } from "./import-batches-card";
import { SyncRunsCard } from "./sync-runs-card";
import { WithingsConnectionCard } from "./withings-connection-card";
import { PageHeader } from "@/components/shared/page-header";

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
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Connected apps"
        subtitle="Withings syncs daily. Health Auto Export pushes Apple Health every hour."
      />

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

      <WithingsConnectionCard
        configured={data.withingsConfigured}
        connection={data.withingsConnection}
        timeZone={data.timeZone}
      />

      <AppleHealthConnectionCard
        configured={data.appleHealthConfigured}
        connection={data.appleHealthConnection}
        hasWebhookToken={data.appleHealthHasWebhookToken}
        streams={data.appleHealthStreams}
        failure={data.appleHealthFailure}
        userId={data.userId}
        appUrl={data.appUrl}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SyncRunsCard
          syncRuns={data.snapshot.syncRuns}
          timeZone={data.timeZone}
        />
        <ImportBatchesCard
          importBatches={data.snapshot.importBatches}
          timeZone={data.timeZone}
        />
      </div>
    </div>
  );
}
