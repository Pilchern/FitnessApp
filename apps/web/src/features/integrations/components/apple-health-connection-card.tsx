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
  lastReceived: {
    daily: string | null;
    sleep: string | null;
    workouts: string | null;
  };
};

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
        <strong>Your webhook token</strong> — add this as the{" "}
        <code className="rounded bg-ink/5 px-1 font-mono text-xs">
          Authorization: Bearer &lt;token&gt;
        </code>{" "}
        header. This token is unique to your account — it&apos;s checked against
        your{" "}
        <code className="rounded bg-ink/5 px-1 font-mono text-xs">
          X-User-Id
        </code>{" "}
        above, so someone else knowing your user id isn&apos;t enough to write
        into your data.
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
  lastReceived,
}: AppleHealthConnectionCardProps) {
  const webhookUrl = `${appUrl}/api/integrations/apple-health/shortcut`;
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
            One iPhone Shortcut, run automatically every evening, sends
            today&apos;s steps, resting heart rate, HRV and VO2 max, last
            night&apos;s sleep, and your Peloton rides (Peloton writes them to
            Apple Health). Steps tick the steps habit on their own.
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
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryStatCard
              label="Steps and activity"
              value={formatIntegrationDateTime(lastReceived.daily)}
              hint="Last time steps, resting HR or VO2 arrived."
              tone={lastReceived.daily ? "accent" : "default"}
            />
            <SummaryStatCard
              label="Sleep and HRV"
              value={formatIntegrationDateTime(lastReceived.sleep)}
              hint="Shows on Recovery."
              tone={lastReceived.sleep ? "accent" : "default"}
            />
            <SummaryStatCard
              label="Rides"
              value={formatIntegrationDateTime(lastReceived.workouts)}
              hint="Only rides are imported; walks and lifts are skipped."
              tone={lastReceived.workouts ? "accent" : "default"}
            />
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine">
              Setup (once, about 15 minutes)
            </p>

            <ol className="space-y-4 text-sm leading-6 text-ink/80">
              <Step n={1}>
                <p>
                  <strong>Token.</strong> Generate it and save it to your
                  password manager.
                </p>
                <GenerateWebhookTokenForm hasWebhookToken={hasWebhookToken} />
              </Step>
              <Step n={2}>
                <p>
                  <strong>Apps.</strong> In the Peloton app turn on Settings
                  &gt; Apple Health &gt; allow writing workouts. Install the
                  free <strong>Actions</strong> app (by Sindre Sorhus), open it
                  once, then restart the phone so its actions show up in
                  Shortcuts.
                </p>
              </Step>
              <Step n={3}>
                <p>
                  <strong>Shortcut &ldquo;Fitness sync&rdquo;</strong>, actions
                  in this order:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Find Health Samples: <em>Steps</em>, Start Date is today,
                    then Calculate Statistics: <em>Sum</em>.
                  </li>
                  <li>
                    Find Health Samples: <em>Resting Heart Rate</em>, last 1
                    day, sort latest first, limit 1.
                  </li>
                  <li>
                    Find Health Samples: <em>Heart Rate Variability</em>, last 1
                    day, then Calculate Statistics: <em>Average</em>.
                  </li>
                  <li>
                    Find Health Samples: <em>VO2 Max</em>, last 30 days, latest
                    first, limit 1.
                  </li>
                  <li>
                    Find Health Samples: <em>Sleep Analysis</em>, last 1 day,
                    value is Core, Deep or REM. Get Details: Duration, then
                    Calculate Statistics: <em>Sum</em> (minutes).
                  </li>
                  <li>
                    Actions app <em>Find Workout</em>, last 2 days. Repeat with
                    each: a Dictionary with <code>type</code>,{" "}
                    <code>start</code> and <code>end</code> (Format Date &gt;
                    ISO 8601), <code>duration_minutes</code>,{" "}
                    <code>avg_heart_rate</code>; add it to a list.
                  </li>
                  <li>
                    Get Contents of URL (below), Method <em>POST</em>, headers{" "}
                    <code>Authorization: Bearer &lt;token&gt;</code> and{" "}
                    <code>X-User-Id</code>, Request Body <em>JSON</em> with{" "}
                    <code>steps</code>, <code>resting_heart_rate</code>,{" "}
                    <code>hrv</code>, <code>vo2_max</code>,{" "}
                    <code>sleep_minutes</code> (Number) and{" "}
                    <code>workouts</code> (Array). Then Show Result.
                  </li>
                </ul>
                <CodeLine value={webhookUrl} />
                <p>Your X-User-Id:</p>
                <CodeLine value={userId} />
              </Step>
              <Step n={4}>
                <p>
                  <strong>Test.</strong> Tap Run. The result lists what was
                  saved and any warnings; the cards above update.
                </p>
              </Step>
              <Step n={5}>
                <p>
                  <strong>Automate.</strong> Automation &gt; Time of Day &gt;
                  9:00 PM daily &gt; Run Immediately, notifications off. Health
                  data is unreadable while the phone has been locked a while, so
                  pick a time it is usually in hand.
                </p>
              </Step>
            </ol>
          </div>
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
