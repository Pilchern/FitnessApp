import type { CardioWeeklyTotals } from "@fitness-app/application";

type CardioSummaryCardsProps = {
  weeklyTotals: CardioWeeklyTotals;
  zone2TargetMinutes: number | null;
};

/** This week in one card: Zone 2 against the target, then the totals. */
export function CardioSummaryCards({
  weeklyTotals,
  zone2TargetMinutes,
}: CardioSummaryCardsProps) {
  const stats = [
    `${weeklyTotals.completedSessions} ${weeklyTotals.completedSessions === 1 ? "ride" : "rides"}`,
    `${weeklyTotals.totalMinutes} min total`,
    weeklyTotals.averageHeartRate != null
      ? `avg HR ${weeklyTotals.averageHeartRate}`
      : null,
  ].filter(Boolean);
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-ink/55">This week · Zone 2</p>
        <p className="text-xs text-ink/55">{stats.join(" · ")}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {weeklyTotals.zone2Minutes}
        <span className="text-base font-normal text-ink/60">
          {zone2TargetMinutes != null && zone2TargetMinutes > 0
            ? ` / ${zone2TargetMinutes} min`
            : " min"}
        </span>
      </p>
      {zone2TargetMinutes != null && zone2TargetMinutes > 0 ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-pine"
            style={{
              width: `${Math.min(100, (weeklyTotals.zone2Minutes / zone2TargetMinutes) * 100)}%`,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
