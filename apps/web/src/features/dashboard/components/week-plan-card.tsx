import Link from "next/link";
import type { WeekPlan } from "../helpers";

type WeekPlanCardProps = {
  plan: WeekPlan;
  zone2Minutes: number;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekPlanCard({ plan, zone2Minutes }: WeekPlanCardProps) {
  const scheduled = plan.days.flatMap((d) => d.items);
  if (scheduled.length === 0) return null;

  const doneCount = scheduled.filter((i) => i.done).length;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Plan
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {doneCount} of {scheduled.length} sessions done
          </h2>
        </div>
        {plan.zone2TargetMinutes > 0 ? (
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
              Zone 2 this week
            </div>
            <div className="mt-1 text-2xl font-semibold text-ink">
              {zone2Minutes}
              <span className="text-base font-normal text-ink/60">
                {" "}
                / {plan.zone2TargetMinutes} min
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <ul className="mt-5 divide-y divide-ink/10">
        {plan.days
          .filter((d) => d.items.length > 0)
          .map((day) =>
            day.items.map((item) => {
              const missed = day.isPast && !item.done;
              return (
                <li
                  key={`${day.date}-${item.templateId}`}
                  className={`flex items-center gap-3 py-2.5 ${day.isToday ? "font-semibold" : ""}`}
                >
                  <span className="w-10 text-sm text-ink/60">
                    {DAY_LABELS[day.dayOfWeek]}
                  </span>
                  <Link
                    href={item.kind === "strength" ? "/strength" : "/cardio"}
                    className="flex-1 text-sm text-ink hover:text-pine"
                  >
                    {item.name}
                    {day.isToday ? (
                      <span className="ml-2 rounded-full bg-pine/10 px-2 py-0.5 text-xs text-pine">
                        Today
                      </span>
                    ) : null}
                  </Link>
                  <span
                    className={`text-xs ${item.done ? "text-pine" : missed ? "text-ember" : "text-ink/50"}`}
                  >
                    {item.done ? "Done" : missed ? "Missed" : "Planned"}
                  </span>
                </li>
              );
            }),
          )}
      </ul>
    </section>
  );
}
