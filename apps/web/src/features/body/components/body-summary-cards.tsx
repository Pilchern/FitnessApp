import type { BodyMetricSummary } from "@fitness-app/application";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatBodyValue,
  formatChange,
} from "../helpers";

type BodySummaryCardsProps = {
  summary: BodyMetricSummary;
};

export function BodySummaryCards({ summary }: BodySummaryCardsProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Latest
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Your numbers</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Weight"
          value={formatBodyValue(summary.latestWeightLb, "lb")}
          hint={formatChange(summary.weightChangeLb, "lb")}
          tone="accent"
        />
        <SummaryStatCard
          label="Waist"
          value={formatBodyValue(summary.latestWaistIn, "in")}
          hint={formatChange(summary.waistChangeIn, "in")}
        />
        <SummaryStatCard
          label="Body fat"
          value={formatBodyValue(summary.latestBodyFatPct, "%")}
          hint="Optional measurement"
        />
        <SummaryStatCard
          label="Muscle mass"
          value={formatBodyValue(summary.latestMuscleMassLb, "lb")}
          hint="Optional measurement"
        />
        {summary.latestFatFreeMassLb != null ? (
          <SummaryStatCard
            label="Fat-free mass"
            value={formatBodyValue(summary.latestFatFreeMassLb, "lb")}
            hint="Lean body mass"
          />
        ) : null}
        {summary.latestBoneMassLb != null ? (
          <SummaryStatCard
            label="Bone mass"
            value={formatBodyValue(summary.latestBoneMassLb, "lb")}
            hint="Optional measurement"
          />
        ) : null}
        {summary.latestHydrationPct != null ? (
          <SummaryStatCard
            label="Hydration"
            value={formatBodyValue(summary.latestHydrationPct, "%")}
            hint="Body water"
          />
        ) : null}
        {summary.latestVisceralFatIndex != null ? (
          <SummaryStatCard
            label="Visceral fat"
            value={String(summary.latestVisceralFatIndex)}
            hint="Index rating"
          />
        ) : null}
      </div>
    </section>
  );
}
