"use client";

import { useActionState, useState } from "react";
import type { IntegrationConnection } from "@fitness-app/domain";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatIntegrationDateTime,
  formatIntegrationStatus,
  getIntegrationStatusGuidance,
  integrationStatusTone,
} from "../helpers";
import { disconnectPelotonAction, syncPelotonAction } from "../actions";

type PelotonConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
};

type ConnectState = { error?: string };

const initialConnectState: ConnectState = {};

export function PelotonConnectionCard({
  configured,
  connection,
}: PelotonConnectionCardProps) {
  const isConnected =
    connection && connection.status !== "disconnected" && connection.deletedAt == null;
  const guidance = getIntegrationStatusGuidance(connection);

  const [connectState, setConnectState] = useState(initialConnectState);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setConnectState({});

    const form = event.currentTarget;
    const username = (form.elements.namedItem("peloton_username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("peloton_password") as HTMLInputElement).value;

    try {
      const response = await fetch("/api/integrations/peloton/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.ok) {
        window.location.href = "/integrations?status=peloton_connected";
      } else {
        setConnectState({ error: data.error ?? "Connection failed." });
        setSubmitting(false);
      }
    } catch {
      setConnectState({ error: "Network error — check your connection and try again." });
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Provider connection
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Peloton</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Import completed rides from your Peloton account. Syncs into the
            same canonical{" "}
            <code className="rounded bg-sand px-1 text-xs">cardio_sessions</code>{" "}
            rows as manual logging. Auto-syncs weekly; you can also trigger a
            manual sync any time.
          </p>
          <p className="mt-1 text-xs leading-5 text-ink/50">
            Uses the Peloton unofficial API. Your credentials are stored
            encrypted and never logged.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Add <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code> to your
            env before connecting.
          </div>
        ) : isConnected ? (
          <div className="flex flex-wrap gap-3">
            <form action={syncPelotonAction}>
              <ActionSubmitButton
                idleLabel="Sync now"
                pendingLabel="Syncing..."
                tone="secondary"
              />
            </form>
            <form action={syncPelotonAction}>
              <input type="hidden" name="mode" value="full" />
              <ActionSubmitButton
                idleLabel="Full resync"
                pendingLabel="Resyncing..."
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
        ) : showForm ? null : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            Connect Peloton
          </button>
        )}
      </div>

      {/* Credential connect form */}
      {!isConnected && showForm ? (
        <form
          onSubmit={handleConnect}
          className="mt-5 max-w-md space-y-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-5"
        >
          <div className="text-sm font-semibold text-ink">
            Enter your Peloton credentials
          </div>

          {connectState.error ? (
            <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
              {connectState.error}
            </div>
          ) : null}

          <label className="grid gap-2 text-sm font-medium text-ink">
            Peloton username or email
            <input
              name="peloton_username"
              type="text"
              autoComplete="username"
              required
              className="h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Password
            <input
              name="peloton_password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {submitting ? "Connecting..." : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setConnectState({});
              }}
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* Connection stats */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Status"
          value={connection ? formatIntegrationStatus(connection.status) : "Disconnected"}
          hint={connection?.accountLabel ?? "No Peloton account linked yet."}
          tone={connection ? integrationStatusTone(connection.status) : "default"}
        />
        <SummaryStatCard
          label="Last sync"
          value={formatIntegrationDateTime(connection?.lastSyncedAt ?? null)}
          hint="Most recent successful ride sync."
          tone={connection?.lastSyncedAt ? "accent" : "default"}
        />
        <SummaryStatCard
          label="Last failure"
          value={formatIntegrationDateTime(connection?.lastFailedAt ?? null)}
          hint={connection?.lastFailureMessage ?? "No recent sync failures."}
          tone={connection?.lastFailedAt ? "alert" : "default"}
        />
        <SummaryStatCard
          label="Cursor"
          value={connection?.lastCursor ? new Date(connection.lastCursor).toLocaleDateString() : "--"}
          hint="Incremental sync resumes from the last successful ride timestamp."
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
        {isConnected
          ? "Connected and syncing. Rides import into your cardio log automatically each week."
          : guidance.text}
      </div>
    </section>
  );
}
