import Link from "next/link";
import type { WeeklyReview } from "@fitness-app/domain";
import { stripDayPrefix, type WeekPlan } from "../helpers";

type WeekPlanCardProps = {
  plan: WeekPlan;
  zone2Minutes: number;
  latestReview: WeeklyReview | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekPlanCard({
  plan,
  zone2Minutes,
  latestReview,
}: WeekPlanCardProps) {
  const scheduled = plan.days.flatMap((d) => d.items);
  if (scheduled.length === 0) return null;

  const doneCount = scheduled.filter((i) => i.done).length;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ink/55">This week</p>
          <h2 className="mt-1 font-display text-lg text-ink">
            {doneCount} of {scheduled.length} sessions done
          </h2>
        </div>
        {plan.zone2TargetMinutes > 0 ? (
          <div className="text-right">
            <div className="text-xs text-ink/55">Zone 2</div>
            <div className="mt-1 text-lg font-semibold text-ink">
              {zone2Minutes}
              <span className="text-base font-normal text-ink/60">
                {" "}
                / {plan.zone2TargetMinutes} min
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-ink/10">
        {plan.days
          .filter((d) => d.items.length > 0)
          .map((day) =>
            day.items.map((item) => {
              const missed = day.isPast && !item.done && !item.skipped;
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
                    {stripDayPrefix(item.name)}
                    {day.isToday ? (
                      <span className="ml-2 rounded-full bg-pine/10 px-2 py-0.5 text-xs text-pine">
                        Today
                      </span>
                    ) : null}
                  </Link>
                  <span
                    className={`text-xs ${item.done ? "font-semibold text-pine" : item.skipped || missed ? "text-ember" : "text-ink/50"}`}
                  >
                    {item.done
                      ? "✓ Done"
                      : item.skipped
                        ? "Skipped"
                        : missed
                          ? "Missed"
                          : day.isToday
                            ? "To do"
                            : ""}
                  </span>
                </li>
              );
            }),
          )}
      </ul>
      <Link
        href="/weekly-review"
        className="mt-2 flex items-center justify-between border-t border-ink/10 pt-3 text-sm text-ink/70 hover:text-pine"
      >
        <span>
          Weekly review
          {latestReview?.scoreDetails != null
            ? ` · last score ${latestReview.scoreDetails.totalScore}/100`
            : ""}
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
