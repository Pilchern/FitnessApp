import Link from "next/link";
import type {
  AdjustedBodyFat,
  BodyMetricSummary,
  WeeklyWeightTrend,
} from "@fitness-app/application";
import type { DexaScan } from "@fitness-app/domain";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatAdjustedHint,
  formatBodyDate,
  formatBodyValue,
  formatChange,
  formatWeeklyWeightHint,
} from "../helpers";

type BodySummaryCardsProps = {
  summary: BodyMetricSummary;
  weeklyWeight: WeeklyWeightTrend;
  latestDexa: DexaScan | null;
  adjustedBodyFat: AdjustedBodyFat | null;
};

export function BodySummaryCards({
  summary,
  weeklyWeight,
  latestDexa,
  adjustedBodyFat,
}: BodySummaryCardsProps) {
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
          hint={formatWeeklyWeightHint(weeklyWeight)}
          tone="accent"
        />
        {summary.latestWaistIn != null ? (
          <SummaryStatCard
            label="Waist"
            value={formatBodyValue(summary.latestWaistIn, "in")}
            hint={formatChange(summary.waistChangeIn, "in")}
          />
        ) : null}
        {summary.latestBodyFatPct != null ? (
          <SummaryStatCard
            label="Body fat (Withings)"
            value={formatBodyValue(summary.latestBodyFatPct, "%")}
            hint="Raw scale reading"
          />
        ) : null}
        {adjustedBodyFat ? (
          <SummaryStatCard
            label="DEXA-adjusted estimate"
            value={`≈ ${formatBodyValue(adjustedBodyFat.estimatePct, "%")}`}
            hint={formatAdjustedHint(adjustedBodyFat)}
          />
        ) : null}
        {latestDexa ? (
          <Link href="/body/dexa" className="block">
            <SummaryStatCard
              label="DEXA body fat"
              value={formatBodyValue(latestDexa.bodyFatPct, "%")}
              hint={`${formatBodyDate(latestDexa.scanDate)} scan · open DEXA`}
            />
          </Link>
        ) : null}
        {summary.latestMuscleMassLb != null ? (
          <SummaryStatCard
            label="Muscle mass"
            value={formatBodyValue(summary.latestMuscleMassLb, "lb")}
          />
        ) : null}
        {summary.latestFatFreeMassLb != null ? (
          <SummaryStatCard
            label="Fat-free mass"
            value={formatBodyValue(summary.latestFatFreeMassLb, "lb")}
            hint="Scale BIA, includes bone"
          />
        ) : null}
        {summary.latestBoneMassLb != null ? (
          <SummaryStatCard
            label="Bone mass"
            value={formatBodyValue(summary.latestBoneMassLb, "lb")}
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
