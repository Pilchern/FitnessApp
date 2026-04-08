import Link from "next/link";
import type { RecoveryCheckin } from "@fitness-app/domain";

type RecoverySnapshotCardProps = {
  latestRecovery: RecoveryCheckin | null;
};

function relativeDate(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkin = new Date(`${isoDate}T00:00:00`);
  const diffMs = today.getTime() - checkin.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays === 2) return "2 days ago";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function readinessColor(value: number | null): string {
  if (value == null) return "text-ink/40";
  if (value >= 7) return "text-pine";
  if (value >= 4) return "text-amber-600";
  return "text-ember";
}

function readinessBg(value: number | null): string {
  if (value == null) return "border-ink/10 bg-sand/60";
  if (value >= 7) return "border-pine/20 bg-pine/10";
  if (value >= 4) return "border-amber-300/40 bg-amber-50";
  return "border-ember/20 bg-ember/10";
}

function scoreColor(value: number | null): string {
  if (value == null) return "text-ink/40";
  if (value >= 8) return "text-pine";
  if (value >= 5) return "text-amber-600";
  return "text-ember";
}

function sleepHours(minutes: number | null): string {
  if (minutes == null) return "--";
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

export function RecoverySnapshotCard({ latestRecovery }: RecoverySnapshotCardProps) {
  if (!latestRecovery) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/75 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Recovery
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">No check-in logged</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Log a daily recovery check-in to track readiness, sleep, and energy.
        </p>
        <Link
          href="/recovery"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Log recovery
        </Link>
      </section>
    );
  }

  const { checkinDate, readinessLevel, sleepDurationMinutes, energyLevel, sorenessLevel, hrv } =
    latestRecovery;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Recovery
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Latest check-in</h2>
        </div>
        <div className="rounded-full border border-ink/10 bg-sand/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
          {relativeDate(checkinDate)}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className={`rounded-[1.25rem] border p-4 ${readinessBg(readinessLevel)}`}>
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Readiness</div>
          <div className={`mt-2 text-3xl font-semibold ${readinessColor(readinessLevel)}`}>
            {readinessLevel != null ? `${readinessLevel}/10` : "--"}
          </div>
          {hrv != null ? (
            <div className="mt-1.5 text-sm text-ink/60">
              HRV {hrv} ms
            </div>
          ) : null}
        </div>
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Sleep</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {sleepHours(sleepDurationMinutes)}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Energy</div>
          <div className={`mt-2 text-3xl font-semibold ${scoreColor(energyLevel)}`}>
            {energyLevel != null ? `${energyLevel}/10` : "--"}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Soreness</div>
          <div className={`mt-2 text-3xl font-semibold ${scoreColor(sorenessLevel != null ? 10 - sorenessLevel : null)}`}>
            {sorenessLevel != null ? `${sorenessLevel}/10` : "--"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href="/recovery"
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          View recovery
        </Link>
      </div>
    </section>
  );
}
