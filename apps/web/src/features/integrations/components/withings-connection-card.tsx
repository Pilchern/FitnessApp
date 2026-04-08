import Link from "next/link";
import type { IntegrationConnection } from "@fitness-app/domain";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatIntegrationDateTime,
  formatIntegrationStatus,
  getIntegrationStatusGuidance,
  integrationStatusTone,
} from "../helpers";
import { disconnectWithingsAction, syncWithingsAction } from "../actions";

type WithingsConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
};

export function WithingsConnectionCard({
  configured,
  connection,
}: WithingsConnectionCardProps) {
  const isConnected =
    connection && connection.status !== "disconnected" && connection.deletedAt == null;
  const guidance = getIntegrationStatusGuidance(connection);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Withings
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Withings</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Automatically import weight, body fat, and muscle mass from your
            Withings scale. Measurements sync into your body log alongside
            anything you&apos;ve entered manually.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Withings is not configured in this environment.
          </div>
        ) : isConnected ? (
          <div className="flex flex-wrap gap-3">
            <form action={syncWithingsAction}>
              <ActionSubmitButton
                idleLabel="Sync measurements"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>

            <form action={syncWithingsAction}>
              <input type="hidden" name="mode" value="full" />
              <ActionSubmitButton
                idleLabel="Re-sync all"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>

            <form action={disconnectWithingsAction}>
              <ActionSubmitButton
                idleLabel="Disconnect"
                pendingLabel="Disconnecting..."
                tone="danger"
              />
            </form>
          </div>
        ) : (
          <Link
            href="/api/integrations/withings/connect"
            className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            Connect Withings
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryStatCard
          label="Status"
          value={connection ? formatIntegrationStatus(connection.status) : "Not connected"}
          hint={connection?.accountLabel ?? "No Withings account linked yet."}
          tone={connection ? integrationStatusTone(connection.status) : "default"}
        />
        <SummaryStatCard
          label="Last synced"
          value={formatIntegrationDateTime(connection?.lastSyncedAt ?? null)}
          hint="Most recent successful measurement sync."
          tone={connection?.lastSyncedAt ? "accent" : "default"}
        />
        <SummaryStatCard
          label="Last error"
          value={formatIntegrationDateTime(connection?.lastFailedAt ?? null)}
          hint={connection?.lastFailureMessage ?? "No recent errors."}
          tone={connection?.lastFailedAt ? "alert" : "default"}
        />
      </div>

      <div
        className={`mt-4 rounded-[1.25rem] border px-4 py-3 text-sm leading-6 ${
          guidance.tone === "alert"
            ? "border-amber-300/40 bg-amber-50 text-amber-700"
            : guidance.tone === "accent"
              ? "border-pine/20 bg-pine/10 text-pine"
              : "border-ink/10 bg-sand/60 text-ink/75"
        }`}
      >
        {guidance.text}{" "}
        {connection?.status === "reauth_required" || connection?.status === "error" ? (
          <Link href="/api/integrations/withings/connect" className="font-semibold underline-offset-4 hover:underline">
            Reconnect Withings
          </Link>
        ) : null}
      </div>
    </section>
  );
}
