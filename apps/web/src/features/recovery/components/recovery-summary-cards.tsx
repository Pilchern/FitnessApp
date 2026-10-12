import type { RecoverySummary } from "@fitness-app/application";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import {
  formatHours,
  formatRestingHeartRate,
  formatScore,
  formatSleepEfficiency,
} from "../helpers";

type RecoverySummaryCardsProps = {
  summary: RecoverySummary;
};

export function RecoverySummaryCards({ summary }: RecoverySummaryCardsProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <h2 className="font-display text-lg text-ink">Last 7 days</h2>

      {/* Only metrics with data in the window: subjective scores are optional
          and most days are synced only, so empty tiles would be noise. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <SummaryStatCard
          label="Sleep"
          value={formatHours(summary.averageSleepHours)}
          hint={
            summary.averageSleepEfficiency != null
              ? `Efficiency ${formatSleepEfficiency(summary.averageSleepEfficiency)}`
              : undefined
          }
        />
        {summary.averageRestingHeartRate != null ? (
          <SummaryStatCard
            label="Resting HR"
            value={formatRestingHeartRate(summary.averageRestingHeartRate)}
          />
        ) : null}
        {summary.averageHrv != null ? (
          <SummaryStatCard
            label="HRV"
            value={`${Math.round(summary.averageHrv)} ms`}
          />
        ) : null}
        {summary.averageReadiness != null ? (
          <SummaryStatCard
            label="Readiness (self)"
            value={formatScore(summary.averageReadiness)}
            hint="1 low, 10 high"
          />
        ) : null}
        {summary.averageSoreness != null ? (
          <SummaryStatCard
            label="Soreness"
            value={formatScore(summary.averageSoreness)}
            hint="1 low, 10 high"
          />
        ) : null}
        {summary.averageStress != null ? (
          <SummaryStatCard
            label="Stress"
            value={formatScore(summary.averageStress)}
            hint="1 low, 10 high"
          />
        ) : null}
        {summary.totalAlcoholCount > 0 ? (
          <SummaryStatCard
            label="Drinks"
            value={String(summary.totalAlcoholCount)}
            hint="Total this week"
            tone={summary.totalAlcoholCount >= 7 ? "alert" : "default"}
          />
        ) : null}
      </div>
    </section>
  );
}
