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
            Shortcut&apos;s Authorization header right away.
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
          replaces it — you&apos;ll need to update your Shortcut with the new
          value.
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
  const webhookUrl = `${appUrl}/api/integrations/apple-health/sleep`;
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
            Push sleep and recovery data from Apple Health using an iPhone
            Shortcut. Once set up, the Shortcut runs automatically each morning
            and syncs last night&apos;s sleep, heart rate, and HRV into your
            recovery log.
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
              hint="Data arrives when you run the Shortcut."
              tone={lastSyncedAt ? "accent" : "default"}
            />
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine">
                Shortcut setup
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                Create an iPhone Shortcut that runs each morning and posts your
                Apple Health data to the webhook below. Follow these steps:
              </p>
            </div>

            <ol className="space-y-4 text-sm leading-6 text-ink/80">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  1
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p>
                    <strong>Webhook URL</strong> — the endpoint your Shortcut
                    posts to:
                  </p>
                  <CodeLine value={webhookUrl} />
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
                    header:
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

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-bold text-pine">
                  4
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    <strong>JSON body</strong> — post an array with one object
                    per night. Supported fields:
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-ink/10 bg-ink/5 px-3 py-2">
                    <pre className="font-mono text-xs leading-5 text-ink/80">
{`[{
  "date": "2026-04-06",
  "sleep_duration_minutes": 450,
  "deep_sleep_minutes": 90,
  "rem_sleep_minutes": 110,
  "core_sleep_minutes": 240,
  "awake_minutes": 10,
  "sleep_efficiency_pct": 95.0,
  "resting_heart_rate": 52,
  "hrv": 68
}]`}
                    </pre>
                  </div>
                  <p className="mt-2 text-xs text-ink/60">
                    All fields except <code className="font-mono">date</code> are optional.
                    The Shortcut can query each metric from Health and only include
                    what is available.
                  </p>
                </div>
              </li>
            </ol>

            <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 px-4 py-3 text-sm leading-6 text-ink/75">
              <strong className="font-semibold text-ink">Tip:</strong> In the
              Shortcuts app, use a &ldquo;Get Health Samples&rdquo; action for each
              metric, then build the JSON dictionary, and finish with a
              &ldquo;Get Contents of URL&rdquo; action set to{" "}
              <strong>POST</strong> with the JSON body and the headers above.
              Automate it to run each morning after you wake up.
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
