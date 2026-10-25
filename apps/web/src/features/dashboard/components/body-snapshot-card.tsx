import Link from "next/link";
import type { WeeklyWeightTrend } from "@fitness-app/application";

type BodySnapshotCardProps = {
  today: string;
  latestWeightLb: number | null;
  latestBodyFatPct: number | null;
  /** DEXA-adjusted estimate of the Withings 7-day average. */
  adjustedBodyFatPct: number | null;
  latestBodyDate: string | null;
  weeklyWeight: WeeklyWeightTrend;
  vo2Max: { value: number; date: string } | null;
  /** Protein-hit days over the last 7; null when nothing is logged, so the line hides. */
  proteinHit: { days: number; of: number } | null;
};

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

function ago(date: string, today: string) {
  const days = daysBetween(date, today);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink/55">{label}</div>
      <div className="mt-1 whitespace-nowrap text-xl font-semibold text-ink">
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-ink/55">{sub}</div> : null}
    </div>
  );
}

export function BodySnapshotCard({
  today,
  latestWeightLb,
  latestBodyFatPct,
  adjustedBodyFatPct,
  latestBodyDate,
  weeklyWeight,
  vo2Max,
  proteinHit,
}: BodySnapshotCardProps) {
  if (latestWeightLb == null && vo2Max == null) return null;

  const avg = weeklyWeight.sevenDayAvgLb;
  const wow = weeklyWeight.weekOverWeekLb;
  const weightSub =
    avg != null && wow != null
      ? `${wow > 0 ? "+" : ""}${wow} lb vs prior week`
      : latestBodyDate
        ? `Weighed ${ago(latestBodyDate, today)}`
        : null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg text-ink">Body</h2>
        <Link
          href="/body"
          className="text-sm font-semibold text-pine hover:underline"
        >
          Details
        </Link>
      </div>

      {weeklyWeight.surplusThrottle ? (
        <p className="mt-3 rounded-2xl border border-ember/25 bg-ember/10 px-4 py-3 text-sm font-medium text-ember">
          Weight is up more than 0.5 lb a week two weeks running. Trim the
          surplus; keep protein at target.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-4">
        {latestWeightLb != null ? (
          <Stat
            label={avg != null ? "Weight, 7-day avg" : "Weight"}
            value={`${avg ?? latestWeightLb} lb`}
            sub={weightSub}
          />
        ) : null}
        {latestBodyFatPct != null ? (
          <Stat
            label="Body fat (Withings)"
            value={`${latestBodyFatPct.toFixed(1)}%`}
            sub={
              adjustedBodyFatPct != null
                ? `DEXA-adj. est. ≈${adjustedBodyFatPct.toFixed(1)}%`
                : null
            }
          />
        ) : null}
        {vo2Max ? (
          <Stat
            label="VO2 max"
            value={vo2Max.value.toFixed(1)}
            sub={ago(vo2Max.date, today)}
          />
        ) : null}
      </div>

      {proteinHit ? (
        <p className="mt-4 text-sm text-ink/70">
          Protein target hit on {proteinHit.days} of {proteinHit.of} logged days
          this week.
        </p>
      ) : null}
    </section>
  );
}
