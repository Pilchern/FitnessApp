import type { SparseTrendPoint } from "@fitness-app/application";
import { TrendChart } from "@/components/shared/trend-chart";

type BodyTrendSectionProps = {
  weightTrend: SparseTrendPoint[];
  waistTrend: SparseTrendPoint[];
  bodyFatTrend: SparseTrendPoint[];
};

function formatWeight(value: number) {
  return `${value.toFixed(1)} lb`;
}

function formatWaist(value: number) {
  return `${value.toFixed(1)} in`;
}

function formatBodyFat(value: number) {
  return `${value.toFixed(1)} %`;
}

export function BodyTrendSection({
  weightTrend,
  waistTrend,
  bodyFatTrend,
}: BodyTrendSectionProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <TrendChart
        title="Weight"
        description="Your weight over time."
        points={weightTrend}
        formatValue={formatWeight}
        emptyMessage="Log a few weigh-ins to see your trend."
      />
      <TrendChart
        title="Waist"
        description="Your waist measurement over time."
        points={waistTrend}
        formatValue={formatWaist}
        emptyMessage="Log waist measurements to see your trend."
        strokeClassName="stroke-ember"
      />
      {bodyFatTrend.length > 1 ? (
        <TrendChart
          title="Body fat"
          description="Your body fat percentage over time."
          points={bodyFatTrend}
          formatValue={formatBodyFat}
          emptyMessage="Log body fat measurements to see your trend."
          strokeClassName="stroke-amber-500"
        />
      ) : null}
    </section>
  );
}
