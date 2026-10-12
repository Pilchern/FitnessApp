"use client";

import { useActionState, useState } from "react";
import type { IntegrationConnection } from "@fitness-app/domain";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import { generateAppleHealthWebhookTokenAction } from "../actions";
import {
  APPLE_HEALTH_STALE_HOURS,
  type AppleHealthStream,
  type AppleHealthStreamStatus,
} from "../helpers";
import type {
  AppleHealthWebhookTokenActionState,
  IntegrationsPageData,
} from "../types";

type AppleHealthConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
  hasWebhookToken: boolean;
  userId: string;
  appUrl: string;
  /** Times are formatted on the server in the profile timezone. */
  streams: Record<AppleHealthStream, AppleHealthStreamStatus>;
  failure: IntegrationsPageData["appleHealthFailure"];
};

const STREAM_TILES: {
  key: AppleHealthStream;
  label: string;
  hint: string;
}[] = [
  {
    key: "daily",
    label: "Steps and activity",
    hint: "Steps, resting HR, HRV, VO2 max.",
  },
  { key: "sleep", label: "Sleep", hint: "Shows on Recovery." },
  {
    key: "workouts",
    label: "Rides",
    hint: "Only rides are imported; walks and lifts are skipped.",
  },
];

function staleHint(hours: number) {
  return hours >= 48
    ? `Nothing new in over ${hours / 24} days. Check the phone.`
    : `Nothing new in over ${hours} hours. Check the phone.`;
}

const initialTokenState: AppleHealthWebhookTokenActionState = {};

function GenerateWebhookTokenForm({
  hasWebhookToken,
}: {
  hasWebhookToken: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    generateAppleHealthWebhookTokenAction,
    initialTokenState,
  );

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p>
        <strong>Your webhook token</strong> goes in the{" "}
        <code className="rounded bg-ink/5 px-1 font-mono text-xs">
          Authorization: Bearer &lt;token&gt;
        </code>{" "}
        header. It only works with your{" "}
        <code className="rounded bg-ink/5 px-1 font-mono text-xs">
          X-User-Id
        </code>
        .
      </p>

      {state.token ? (
        <div className="space-y-2">
          <CodeLine value={state.token} />
          <p className="text-xs font-semibold text-ember">
            Copy this now. It won&apos;t be shown again. Paste it into both
            Health Auto Export automations right away.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-xs font-semibold text-ember">{state.error}</p>
      ) : null}

      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-8 items-center justify-center rounded-full border border-ink/15 px-3 text-xs font-semibold text-ink transition hover:border-pine hover:text-pine disabled:opacity-60"
        >
          {isPending
            ? "Generating..."
            : hasWebhookToken || state.token
              ? "Regenerate webhook token"
              : "Generate webhook token"}
        </button>
      </form>

      {hasWebhookToken && !state.token ? (
        <p className="text-xs text-ink/60">
          A token already exists. Regenerating replaces it, so both Health Auto
          Export automations need the new value.
        </p>
      ) : null}
    </div>
  );
}

function CodeLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-ink/10 bg-ink/5 px-3 py-2 font-mono text-xs text-ink/80 whitespace-nowrap">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 inline-flex h-8 items-center justify-center rounded-full border border-ink/15 px-3 text-xs font-semibold text-ink transition hover:border-pine hover:text-pine"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function AppleHealthConnectionCard({
  configured,
  connection,
  hasWebhookToken,
  userId,
  appUrl,
  streams,
  failure,
}: AppleHealthConnectionCardProps) {
  const webhookUrl = `${appUrl}/api/integrations/apple-health/health-auto-export`;
  const lastSyncedAt = connection?.lastSyncedAt ?? null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Apple Health
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Apple Health</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Health Auto Export on your iPhone posts steps, resting HR, HRV, VO2
            max, sleep and Peloton rides every hour. Steps tick the steps habit
            on their own.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Add{" "}
            <code className="font-mono text-xs">
              INTEGRATION_ENCRYPTION_KEY
            </code>{" "}
            to your environment to enable this integration.
          </div>
        ) : lastSyncedAt ? (
          <div className="rounded-full border border-pine/20 bg-pine/10 px-4 py-2 text-sm font-semibold text-pine">
            Active
          </div>
        ) : (
          <div className="rounded-full border border-ink/15 bg-sand/60 px-4 py-2 text-sm font-semibold text-ink/60">
            Awaiting first sync
          </div>
        )}
      </div>

      {configured ? (
        <>
          {failure ? (
            <div
              role="alert"
              className="mt-6 rounded-[1.25rem] border border-ember/20 bg-ember/10 px-4 py-3 text-sm leading-6 text-ember"
            >
              {failure.label} sync failed {failure.at}
              {failure.message ? `: ${failure.message}` : "."}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STREAM_TILES.map((tile) => {
              const stream = streams[tile.key];
              return (
                <SummaryStatCard
                  key={tile.key}
                  label={tile.label}
                  value={stream.lastReceivedLabel}
                  hint={
                    stream.stale
                      ? staleHint(APPLE_HEALTH_STALE_HOURS[tile.key])
                      : tile.hint
                  }
                  tone={
                    stream.stale
                      ? "alert"
                      : stream.received
                        ? "accent"
                        : "default"
                  }
                />
              );
            })}
          </div>

          <details className="group mt-6">
            <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.2em] text-pine [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show setup</span>
              <span className="hidden group-open:inline">Hide setup</span>
            </summary>

            <ol className="mt-4 space-y-4 text-sm leading-6 text-ink/80">
              <Step n={1}>
                <p>
                  <strong>Token.</strong> Generate it and save it to your
                  password manager.
                </p>
                <GenerateWebhookTokenForm hasWebhookToken={hasWebhookToken} />
              </Step>
              <Step n={2}>
                <p>
                  <strong>Peloton.</strong> In the Peloton app turn on Settings
                  &gt; Apple Health &gt; allow writing workouts.
                </p>
              </Step>
              <Step n={3}>
                <p>
                  <strong>Health Auto Export</strong> (Premium) &gt; Automations
                  &gt; REST API. Both automations below use this URL, format
                  JSON, and two headers:{" "}
                  <code>Authorization: Bearer &lt;token&gt;</code> and{" "}
                  <code>X-User-Id</code>.
                </p>
                <CodeLine value={webhookUrl} />
                <p>Your X-User-Id:</p>
                <CodeLine value={userId} />
              </Step>
              <Step n={4}>
                <p>
                  <strong>&ldquo;Health Metrics&rdquo;</strong>: Step Count,
                  Resting Heart Rate, Heart Rate Variability, VO2 Max, Apple
                  Exercise Time, Active Energy, Sleep Analysis. Aggregate by
                  day, Since Last Sync, every hour.
                </p>
              </Step>
              <Step n={5}>
                <p>
                  <strong>&ldquo;Workouts&rdquo;</strong>: Export Version 2,
                  workout metrics and route off, Since Last Sync, every hour.
                </p>
              </Step>
              <Step n={6}>
                <p>
                  <strong>Test.</strong> Run each automation once by hand. The
                  cards above update.
                </p>
              </Step>
            </ol>
          </details>
        </>
      ) : (
        <div className="mt-4 rounded-[1.25rem] border border-ink/10 bg-sand/60 px-4 py-3 text-sm leading-6 text-ink/75">
          Once configured, you&apos;ll see your webhook URL and setup
          instructions here. Add{" "}
          <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code>{" "}
          (a base64-encoded 32-byte key) to your{" "}
          <code className="font-mono text-xs">.env.local</code> to get started —
          it&apos;s used to encrypt the per-user webhook token you&apos;ll
          generate here.
        </div>
      )}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </li>
  );
}
