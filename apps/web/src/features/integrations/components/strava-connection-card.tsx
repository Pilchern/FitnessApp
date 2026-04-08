"use client";

import type { IntegrationConnection } from "@fitness-app/domain";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatIntegrationDateTime,
  formatIntegrationStatus,
  getIntegrationStatusGuidance,
  integrationStatusTone,
} from "../helpers";
import { disconnectStravaAction, syncStravaAction } from "../actions";

type StravaConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
};

export function StravaConnectionCard({
  configured,
  connection,
}: StravaConnectionCardProps) {
  const isConnected =
    connection && connection.status !== "disconnected" && connection.deletedAt == null;
  const guidance = getIntegrationStatusGuidance(connection);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Strava
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Strava</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Automatically import your rides and outdoor activities from Strava.
            New workouts sync into your cardio log every week, and you can
            trigger a manual sync any time.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Strava is not configured in this environment.
          </div>
        ) : isConnected ? (
          <div className="flex flex-wrap gap-3">
            <form action={syncStravaAction}>
              <ActionSubmitButton
                idleLabel="Sync workouts"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>
            <form action={syncStravaAction}>
              <input type="hidden" name="mode" value="full" />
              <ActionSubmitButton
                idleLabel="Re-sync all"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>
            <form action={disconnectStravaAction}>
              <ActionSubmitButton
                idleLabel="Disconnect"
                pendingLabel="Disconnecting..."
                tone="danger"
              />
            </form>
          </div>
        ) : (
          <a
            href="/api/integrations/strava/connect"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#FC4C02] px-5 text-sm font-semibold text-white transition hover:bg-[#e04400]"
          >
            Connect Strava
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryStatCard
          label="Status"
          value={connection ? formatIntegrationStatus(connection.status) : "Not connected"}
          hint={connection?.accountLabel ?? "No Strava account linked yet."}
          tone={connection ? integrationStatusTone(connection.status) : "default"}
        />
        <SummaryStatCard
          label="Last synced"
          value={formatIntegrationDateTime(connection?.lastSyncedAt ?? null)}
          hint="Most recent successful workout sync."
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
