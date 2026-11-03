import Link from "next/link";
import { readinessLevel, type DailyReadiness } from "@fitness-app/application";
import { stripDayPrefix, type WeekPlanItem } from "../helpers";
import { FeelPicker } from "./feel-picker";

type TodayCardProps = {
  today: string;
  readiness: DailyReadiness;
  history: { date: string; score: number | null }[];
  call: string;
  todayItems: WeekPlanItem[];
  stepsToday: number | null;
  /** Today's logged how-you-feel rating, 1-10. */
  feelToday: number | null;
};

const LEVEL_LABEL = { good: "Good", fair: "Fair", low: "Low" } as const;
const LEVEL_TEXT = {
  good: "text-pine",
  fair: "text-amber-600",
  low: "text-ember",
} as const;
const LEVEL_BAR = {
  good: "bg-pine",
  fair: "bg-amber-400",
  low: "bg-ember",
} as const;

function formatDay(isoDate: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function TodayCard({
  today,
  readiness,
  history,
  call,
  todayItems,
  stepsToday,
  feelToday,
}: TodayCardProps) {
  const scored = readiness.status === "scored" ? readiness : null;
  const stale = readiness.date != null && readiness.date !== today;
  const showHistory = history.filter((h) => h.score != null).length >= 2;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        {formatDay(today, { weekday: "long", month: "short", day: "numeric" })}
      </p>

      <div className="mt-4 flex items-center gap-5">
        <div
          className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${
            scored
              ? scored.level === "good"
                ? "border-pine/70"
                : scored.level === "fair"
                  ? "border-amber-400"
                  : "border-ember/70"
              : "border-ink/10"
          }`}
          aria-label={
            scored
              ? `Readiness ${scored.score} of 100`
              : "Readiness unavailable"
          }
        >
          <span className="text-3xl font-semibold leading-none text-ink">
            {scored ? scored.score : "--"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink/60">
            Readiness
            {scored ? (
              <>
                {" · "}
                <span className={`font-semibold ${LEVEL_TEXT[scored.level]}`}>
                  {LEVEL_LABEL[scored.level]}
                </span>
              </>
            ) : null}
            {stale ? " · from yesterday" : null}
          </p>
          <p className="mt-1 text-base font-semibold leading-6 text-ink">
            {call}
          </p>
          {readiness.status === "insufficient" ? (
            <p className="mt-1 text-sm text-ink/60">{readiness.reason}</p>
          ) : null}
          {scored && scored.limiters.length > 0 ? (
            <p className="mt-1 text-sm text-ink/60">
              Pulling it down: {scored.limiters.join("; ")}
            </p>
          ) : null}
        </div>
      </div>

      <FeelPicker date={today} current={feelToday} />

      {todayItems.length > 0 || stepsToday != null ? (
        <ul className="mt-5 divide-y divide-ink/10 border-t border-ink/10">
          {todayItems.map((item) => (
            <li key={item.templateId}>
              <Link
                href={item.kind === "strength" ? "/strength" : "/cardio"}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="font-medium text-ink">
                  {stripDayPrefix(item.name)}
                </span>
                <span
                  className={
                    item.done ? "text-pine" : "font-semibold text-pine"
                  }
                >
                  {item.done
                    ? "Done"
                    : item.kind === "strength"
                      ? "Start →"
                      : "Log →"}
                </span>
              </Link>
            </li>
          ))}
          {stepsToday != null ? (
            <li className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="text-ink/70">Steps so far</span>
              <span className="font-medium text-ink">
                {stepsToday.toLocaleString("en-US")}
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {scored ? (
        <details className="group mt-2 border-t border-ink/10 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink/70">
            What went into it
            <span className="text-ink/40 transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-3 space-y-4">
            {scored.groups.map((g) => (
              <div key={g.group}>
                <p className="flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">
                  <span>
                    {g.label} · {Math.round(g.weight * 100)}%
                  </span>
                  <span className={LEVEL_TEXT[g.level]}>{g.score}</span>
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {scored.components
                    .filter((c) => c.group === g.group)
                    .map((c) => (
                      <li
                        key={c.key}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="shrink-0 text-ink">{c.label}</span>
                        <span className="min-w-0 text-right text-ink/60">
                          {c.detail}
                          <span
                            className={`ml-2 font-semibold ${LEVEL_TEXT[c.level]}`}
                          >
                            {c.score}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            {scored.caps.length > 0 ? (
              <ul className="space-y-1">
                {scored.caps.map((cap) => (
                  <li key={cap} className="text-sm text-ember">
                    Capped: {cap}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {showHistory ? (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-ink/50">
                Last 7 days
              </p>
              <div className="mt-2 flex h-14 items-end gap-1.5">
                {history.map((h) => (
                  <div
                    key={h.date}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div
                      className={`w-full rounded-sm ${h.score != null ? LEVEL_BAR[readinessLevel(h.score)] : "bg-ink/10"}`}
                      style={{
                        height: `${h.score != null ? Math.max(8, h.score * 0.4) : 4}px`,
                      }}
                      title={
                        h.score != null
                          ? `${h.date}: ${h.score}`
                          : `${h.date}: no score`
                      }
                    />
                    <span className="text-[10px] text-ink/50">
                      {formatDay(h.date, { weekday: "narrow" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-ink/50">
            Every signal against your own last 30 days: HRV (7-night trend and
            last night), overnight heart rate and vitals; sleep amount, debt,
            quality and timing; yesterday&apos;s strain and this week&apos;s
            load; yesterday&apos;s calories, protein and drinks; and soreness,
            stress, energy and the knee check when you log them. A usual reading
            scores about 80, so the number moves with the day. How you feel,
            when you tap it, is 30%. Signals that are missing are left out, not
            counted against you. Two vitals up at once, feeling rough, soreness
            8+, a knee-off check or 3+ drinks cap the day. An estimate, not a
            medical measure.
            {scored.calibrating
              ? ` HRV joins the score after 14 nights of baseline (${scored.baselineDays} so far): one night of Watch HRV is too noisy to act on.`
              : null}
          </p>
        </details>
      ) : null}
    </section>
  );
}
