"use client";

import { useActionState, useState } from "react";
import type { IntegrationConnection } from "@fitness-app/domain";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import { generateAppleHealthWebhookTokenAction } from "../actions";
import { formatIntegrationDateTime } from "../helpers";
import type { AppleHealthWebhookTokenActionState } from "../types";

type AppleHealthConnectionCardProps = {
  configured: boolean;
  connection: IntegrationConnection | null;
  hasWebhookToken: boolean;
  userId: string;
  appUrl: string;
};

const initialTokenState: AppleHealthWebhookTokenActionState = {};

function GenerateWebhookTokenForm({ hasWebhookToken }: { hasWebhookToken: boolean }) {
  const [state, formAction, isPending] = useActionState(
    generateAppleHealthWebhookTokenAction,
    initialTokenState,
  );

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p>
        <strong>Your webhook token</strong> — add this as the{" "}
        <code className="rounded bg-ink/5 px-1 font-mono text-xs">
          Authorization: Bearer &lt;token&gt;
        </code>{" "}
        header. This token is unique to your account — it&apos;s checked
        against your <code className="rounded bg-ink/5 px-1 font-mono text-xs">X-User-Id</code>{" "}
        above, so someone else knowing your user id isn&apos;t enough to write into
        your data.
      </p>

      {state.token ? (
        <div className="space-y-2">
          <CodeLine value={state.token} />
          <p className="text-xs font-semibold text-ember">
            Copy this now — it won&apos;t be shown again. Paste it into your
            bridge app&apos;s Authorization header right away.
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
          A token has already been generated for your account. Regenerating
          replaces it — you&apos;ll need to update your bridge app with the
          new value.
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
}: AppleHealthConnectionCardProps) {
  const sleepWebhookUrl = `${appUrl}/api/integrations/apple-health/sleep`;
  const dailyMetricsWebhookUrl = `${appUrl}/api/integrations/apple-health/daily-metrics`;
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
            Push sleep, recovery, and daily activity data from Apple Health
            using a bridge app on your phone. Set it up once and it runs on
            its own background schedule from then on — nothing to open or
            run yourself day to day.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-[1.25rem] border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            Add <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code> to your
            environment to enable this integration.
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
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SummaryStatCard
              label="Last synced"
              value={formatIntegrationDateTime(lastSyncedAt)}
              hint="Most recent successful sleep data push."
              tone={lastSyncedAt ? "accent" : "default"}
            />
            <SummaryStatCard
              label="Status"
              value={lastSyncedAt ? "Receiving data" : "Not yet synced"}
              hint="Data arrives automatically on your bridge app's schedule — nothing to run."
              tone={lastSyncedAt ? "accent" : "default"}
            />
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine">
                Recommended: Health Auto Export
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                Install{" "}
                <a
                  href="https://www.healthyapps.dev/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-pine underline"
                >
                  Health Auto Export
                </a>
                , then under <strong>Automations → REST API export</strong>{" "}
                add the headers and webhook URLs below. Once its schedule is
                set, it pushes data in the background on its own — no need to
                open the app, run a Shortcut, or do anything else afterward.
              </p>
            </div>

            <ol className="space-y-4 text-sm leading-6 text-ink/80">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  1
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p>
                    <strong>Sleep webhook URL</strong> — once daily, shortly
                    after waking:
                  </p>
                  <CodeLine value={sleepWebhookUrl} />
                  <p>
                    <strong>Daily activity webhook URL</strong> — every 4–6
                    hours through the day (steps, VO2 max, resting HR,
                    exercise minutes, active energy):
                  </p>
                  <CodeLine value={dailyMetricsWebhookUrl} />
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  2
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p>
                    <strong>Your user ID</strong> — add this as the{" "}
                    <code className="rounded bg-ink/5 px-1 font-mono text-xs">X-User-Id</code>{" "}
                    header on both:
                  </p>
                  <CodeLine value={userId} />
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  3
                </span>
                <GenerateWebhookTokenForm hasWebhookToken={hasWebhookToken} />
              </li>
            </ol>

            <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 px-4 py-3 text-sm leading-6 text-ink/75">
              <strong className="font-semibold text-ink">
                Don&apos;t want Health Auto Export?
              </strong>{" "}
              You can build your own automation instead with the Shortcuts
              app (a &ldquo;Get Health Samples&rdquo; action per metric, a
              JSON dictionary, then &ldquo;Get Contents of URL&rdquo; set to{" "}
              <strong>POST</strong> with the headers above). Turn off
              &ldquo;Ask Before Running&rdquo; on its personal automation
              trigger so it runs in the background too, the same as Health
              Auto Export — see the full payload shapes for both endpoints in{" "}
              <code className="font-mono text-xs">
                docs/integrations/apple-health-bridge-setup.md
              </code>
              .
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[1.25rem] border border-ink/10 bg-sand/60 px-4 py-3 text-sm leading-6 text-ink/75">
          Once configured, you&apos;ll see your webhook URL and setup
          instructions here. Add{" "}
          <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code>{" "}
          (a base64-encoded 32-byte key) to your{" "}
          <code className="font-mono text-xs">.env.local</code> to get started
          — it&apos;s used to encrypt the per-user webhook token you&apos;ll
          generate here.
        </div>
      )}
    </section>
  );
}
