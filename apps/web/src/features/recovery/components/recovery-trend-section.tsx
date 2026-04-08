import type { SparseTrendPoint } from "@fitness-app/application";
import { TrendChart } from "@/components/shared/trend-chart";

type RecoveryTrendSectionProps = {
  sleepTrend: SparseTrendPoint[];
  restingHeartRateTrend: SparseTrendPoint[];
  hrvTrend: SparseTrendPoint[];
};

function formatHours(value: number) {
  return `${Math.round(value * 10) / 10}h`;
}

function formatHeartRate(value: number) {
  return `${Math.round(value)} bpm`;
}

function formatHrv(value: number) {
  return `${Math.round(value)} ms`;
}

export function RecoveryTrendSection({
  sleepTrend,
  restingHeartRateTrend,
  hrvTrend,
}: RecoveryTrendSectionProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <TrendChart
        title="Sleep"
        description="Hours slept per night."
        points={sleepTrend}
        formatValue={formatHours}
        emptyMessage="Log a few nights of sleep to see your trend."
      />
      <TrendChart
        title="Resting heart rate"
        description="Your resting HR over time. Lower is generally better."
        points={restingHeartRateTrend}
        formatValue={formatHeartRate}
        emptyMessage="Add resting HR in your daily check-in to see this chart."
        strokeClassName="stroke-ember"
      />
      <TrendChart
        title="HRV"
        description="Heart rate variability. Higher is generally better for recovery."
        points={hrvTrend}
        formatValue={formatHrv}
        emptyMessage="HRV syncs automatically from Apple Health, or enter it manually."
        strokeClassName="stroke-pine"
      />
    </section>
  );
}
