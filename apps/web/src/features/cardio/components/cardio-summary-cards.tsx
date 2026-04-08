import type {
  CardioAdherenceSummary,
  CardioWeeklyTotals,
} from "@fitness-app/application";
import { formatCardioDate } from "../helpers";

type CardioSummaryCardsProps = {
  weeklyTotals: CardioWeeklyTotals;
  adherence: CardioAdherenceSummary;
};

const adherenceStatusStyles: Record<
  CardioAdherenceSummary["items"][number]["status"],
  string
> = {
  completed: "border-pine/25 bg-pine/10 text-pine",
  skipped: "border-ember/20 bg-ember/10 text-ember",
  due: "border-amber-300/40 bg-amber-50 text-amber-700",
  pending: "border-ink/10 bg-white text-ink/70",
};

const adherenceStatusLabels: Record<
  CardioAdherenceSummary["items"][number]["status"],
  string
> = {
  completed: "Done",
  skipped: "Skipped",
  due: "Today",
  pending: "Upcoming",
};

export function CardioSummaryCards({
  weeklyTotals,
  adherence,
}: CardioSummaryCardsProps) {
  const adherencePercent =
    adherence.expectedCount > 0
      ? Math.round((adherence.completedCount / adherence.expectedCount) * 100)
      : 100;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          This week
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Weekly totals</h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
              Workouts logged
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {weeklyTotals.completedSessions}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
              Total minutes
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {weeklyTotals.totalMinutes}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
              Zone 2 minutes
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {weeklyTotals.zone2Minutes}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
              Avg HR
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {weeklyTotals.averageHeartRate ?? "--"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
              Adherence
            </p>
            <h2 className="mt-3 font-display text-2xl text-ink">
              This week
            </h2>
          </div>
          <div className="rounded-full border border-pine/20 bg-pine/10 px-4 py-2 text-sm font-semibold text-pine">
            {adherence.completedCount}/{adherence.expectedCount || adherence.items.length} complete
          </div>
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Completion rate
          </div>
          <div className="mt-2 text-4xl font-semibold text-ink">
            {adherencePercent}%
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {adherence.items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-ink/10 bg-white/60 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-ink">{item.label}</div>
                <div className="text-xs text-ink/65">
                  {formatCardioDate(item.targetDate)}
                </div>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${adherenceStatusStyles[item.status]}`}
              >
                {adherenceStatusLabels[item.status]}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
