import type { GoalProgress } from "../types";

type GoalProgressCardProps = {
  goalProgress: GoalProgress[];
};

function TrendArrow({ trend }: { trend: GoalProgress["trend"] }) {
  if (trend === "improving") {
    return <span className="text-pine" aria-label="improving">↑</span>;
  }
  if (trend === "declining") {
    return <span className="text-ember" aria-label="declining">↓</span>;
  }
  if (trend === "maintaining") {
    return <span className="text-ink/40" aria-label="maintaining">→</span>;
  }
  return <span className="text-ink/30" aria-label="insufficient data">—</span>;
}

export function GoalProgressCard({ goalProgress }: GoalProgressCardProps) {
  if (goalProgress.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Progress
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">Goals</h2>
      <p className="mt-1 text-sm text-ink/60">Based on your last 4 weeks</p>

      <div className="mt-5 divide-y divide-ink/8">
        {goalProgress.map((goal) => (
          <div key={goal.label} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{goal.label}</p>
              <p className="mt-0.5 text-xs text-ink/55 leading-5">
                {goal.trend === "insufficient_data"
                  ? "Not enough data yet — keep logging"
                  : goal.trendDetail}
              </p>
            </div>
            <div className="flex-shrink-0 text-xl font-bold leading-none">
              <TrendArrow trend={goal.trend} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
