import type { IntegrationConnection } from "@fitness-app/domain";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatIntegrationDateTime,
  formatIntegrationStatus,
  getIntegrationStatusGuidance,
  integrationStatusTone,
} from "../helpers";
import {
  connectPelotonAction,
  disconnectPelotonAction,
  syncPelotonAction,
} from "../actions";

type PelotonConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
};

export function PelotonConnectionCard({
  configured,
  connection,
}: PelotonConnectionCardProps) {
  const isConnected =
    connection &&
    connection.status !== "disconnected" &&
    connection.deletedAt == null;
  const guidance = getIntegrationStatusGuidance(connection);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Peloton
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Peloton</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Automatically import completed rides — including average watts,
            cadence, and resistance — using your Peloton account. There is no
            public Peloton API, so this signs in with your Peloton username and
            password directly; they&apos;re encrypted before storage and never
            leave this app.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Peloton is not configured in this environment.
          </div>
        ) : null}
        {isConnected ? (
          <div className="flex flex-wrap gap-3">
            <form action={syncPelotonAction}>
              <ActionSubmitButton
                idleLabel="Sync rides"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>
            <form action={syncPelotonAction}>
              <input type="hidden" name="mode" value="full" />
              <ActionSubmitButton
                idleLabel="Re-sync all"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>
            <form action={disconnectPelotonAction}>
              <ActionSubmitButton
                idleLabel="Disconnect"
                pendingLabel="Disconnecting..."
                tone="danger"
              />
            </form>
          </div>
        ) : null}
      </div>

      {configured && !isConnected ? (
        <div className="mt-5 rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
          Peloton is currently blocking third-party sign-ins to this endpoint
          (confirmed 2026-07-16) — connecting below will likely fail with a 403
          regardless of your credentials. Peloton has a native &quot;auto-export
          to Strava&quot; setting in its own Settings → Connected Apps that
          syncs your rides through Strava instead (reduced cadence/resistance
          detail, but working). Trying to connect here won&apos;t hurt anything
          if you want to check whether Peloton has re-opened access.
        </div>
      ) : null}

      {configured && !isConnected ? (
        <form
          action={connectPelotonAction}
          className="mt-5 flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink/80">
              Peloton username or email
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              className="w-full rounded-full border border-ink/15 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-pine"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink/80">
              Peloton password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full rounded-full border border-ink/15 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-pine"
            />
          </label>
          <ActionSubmitButton
            idleLabel="Connect Peloton"
            pendingLabel="Connecting..."
            tone="primary"
          />
        </form>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryStatCard
          label="Status"
          value={
            connection
              ? formatIntegrationStatus(connection.status)
              : "Not connected"
          }
          hint={connection?.accountLabel ?? "No Peloton account linked yet."}
          tone={
            connection ? integrationStatusTone(connection.status) : "default"
          }
        />
        <SummaryStatCard
          label="Last synced"
          value={formatIntegrationDateTime(connection?.lastSyncedAt ?? null)}
          hint="Most recent successful ride sync."
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
        {guidance.text}
      </div>
    </section>
  );
}
