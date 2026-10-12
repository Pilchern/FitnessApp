import type { CardioWeeklyTotals } from "@fitness-app/application";

type CardioSummaryCardsProps = {
  weeklyTotals: CardioWeeklyTotals;
  zone2TargetMinutes: number | null;
};

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-ink">{children}</div>
    </div>
  );
}

export function CardioSummaryCards({
  weeklyTotals,
  zone2TargetMinutes,
}: CardioSummaryCardsProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        This week
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">Weekly totals</h2>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Zone 2 minutes">
          {weeklyTotals.zone2Minutes}
          {zone2TargetMinutes != null ? (
            <span className="text-lg font-normal text-ink/60">
              {" "}
              / {zone2TargetMinutes}
            </span>
          ) : null}
        </Tile>
        <Tile label="Workouts">{weeklyTotals.completedSessions}</Tile>
        <Tile label="Total minutes">{weeklyTotals.totalMinutes}</Tile>
        <Tile label="Avg HR">{weeklyTotals.averageHeartRate ?? "--"}</Tile>
      </div>
    </section>
  );
}
