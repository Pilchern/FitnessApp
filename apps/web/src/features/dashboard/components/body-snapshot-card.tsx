import Link from "next/link";
import { TrendChart } from "@/components/shared/trend-chart";
import type { SparseTrendPoint } from "@fitness-app/application";

type BodySnapshotCardProps = {
  latestWeightLb: number | null;
  weightChangeLb: number | null;
  latestWaistIn: number | null;
  waistChangeIn: number | null;
  latestBodyFatPct: number | null;
  latestBodyDate: string | null;
  weightTrend: SparseTrendPoint[];
};

function bodyRelativeDate(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const logged = new Date(`${isoDate}T00:00:00`);
  const diffDays = Math.round((today.getTime() - logged.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function directionArrow(change: number | null): string {
  if (change == null || change === 0) return "";
  return change > 0 ? " ↑" : " ↓";
}

function formatChange(change: number | null, unit: string): string {
  if (change == null) return "";
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change} ${unit}${directionArrow(change)} vs first logged`;
}

function changeTone(change: number | null): string {
  if (change == null) return "text-ink/40";
  if (change < 0) return "text-pine";
  if (change > 0) return "text-ember";
  return "text-ink/60";
}

export function BodySnapshotCard({
  latestWeightLb,
  weightChangeLb,
  latestWaistIn,
  waistChangeIn,
  latestBodyFatPct,
  latestBodyDate,
  weightTrend,
}: BodySnapshotCardProps) {
  const hasAnyData = latestWeightLb != null || latestWaistIn != null;

  if (!hasAnyData) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/75 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Body
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">No measurements yet</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Log weight and waist measurements to track body composition trends.
        </p>
        <Link
          href="/body"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Log measurement
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Body
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Composition</h2>
          {latestBodyDate ? (
            <p className="mt-1 text-xs text-ink/50">Updated {bodyRelativeDate(latestBodyDate)}</p>
          ) : null}
        </div>
        <Link
          href="/body"
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          View body
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Weight</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {latestWeightLb != null ? `${latestWeightLb} lb` : "--"}
          </div>
          {weightChangeLb != null ? (
            <div className={`mt-1.5 text-sm font-medium ${changeTone(weightChangeLb)}`}>
              {formatChange(weightChangeLb, "lb")}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Waist</div>
          <div className="mt-2 text-3xl font-semibold text-ink">
            {latestWaistIn != null ? `${latestWaistIn}"` : "--"}
          </div>
          {waistChangeIn != null ? (
            <div className={`mt-1.5 text-sm font-medium ${changeTone(waistChangeIn)}`}>
              {formatChange(waistChangeIn, "in")}
            </div>
          ) : null}
        </div>

        {latestBodyFatPct != null ? (
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Body fat</div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {`${latestBodyFatPct.toFixed(1)} %`}
            </div>
          </div>
        ) : null}
      </div>

      {weightTrend.length > 1 ? (
        <div className="mt-4">
          <TrendChart
            title="Weight trend"
            description="Last 90 days"
            points={weightTrend}
            formatValue={(v) => `${v} lb`}
            emptyMessage="Log weight measurements to see a trend."
            strokeClassName="stroke-pine"
          />
        </div>
      ) : null}
    </section>
  );
}
