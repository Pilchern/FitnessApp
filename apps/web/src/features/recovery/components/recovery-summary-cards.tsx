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
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            7-day average
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Recovery</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryStatCard
          label="Sleep avg"
          value={formatHours(summary.averageSleepHours)}
          hint={
            summary.averageSleepEfficiency != null
              ? `Efficiency ${formatSleepEfficiency(summary.averageSleepEfficiency)}`
              : "Only days with sleep logged"
          }
        />
        <SummaryStatCard
          label="Readiness avg"
          value={formatScore(summary.averageReadiness)}
          hint="1 low, 10 high"
          tone="accent"
        />
        <SummaryStatCard
          label="Stress avg"
          value={formatScore(summary.averageStress)}
          hint="1 low, 10 high"
        />
        <SummaryStatCard
          label="Soreness avg"
          value={formatScore(summary.averageSoreness)}
          hint="1 low, 10 high"
        />
        <SummaryStatCard
          label="Resting HR avg"
          value={formatRestingHeartRate(summary.averageRestingHeartRate)}
          hint={`${summary.totalAlcoholCount} drinks logged`}
          tone={summary.totalAlcoholCount > 0 ? "alert" : "default"}
        />
        <SummaryStatCard
          label="HRV avg"
          value={summary.averageHrv != null ? `${Math.round(summary.averageHrv)} ms` : "--"}
          hint="Higher is better. Syncs from Apple Health."
          tone={
            summary.averageHrv == null
              ? "default"
              : summary.averageHrv >= 60
                ? "accent"
                : summary.averageHrv >= 40
                  ? "default"
                  : "alert"
          }
        />
      </div>
    </section>
  );
}
