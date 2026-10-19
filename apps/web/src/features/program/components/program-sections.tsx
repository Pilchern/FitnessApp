import Link from "next/link";
import type { ProgramPageData } from "../types";
import {
  dayShort,
  formatShortDate,
  hardSetBand,
  limbSymmetryPct,
  type SessionCompletion,
} from "../helpers";

const card =
  "rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6";

const COMPLETION: Record<
  SessionCompletion,
  { label: string; tone: string } | null
> = {
  done: { label: "Done", tone: "text-pine" },
  missed: { label: "Missed", tone: "text-ember font-semibold" },
  today: { label: "Today", tone: "text-pine" },
  planned: { label: "Planned", tone: "text-ink/50" },
  none: null,
};

const KNEE_TAG = {
  normal: "Knee normal",
  hold: "Repeat loads",
  knee_off: "Knee day off",
} as const;

export function ProgramWeekView({ week }: { week: ProgramPageData["week"] }) {
  const tracked = week.flatMap((d) =>
    d.sessions.filter((s) => s.visible && s.completion !== "none"),
  );
  const done = tracked.filter((s) => s.completion === "done").length;
  const missed = tracked.filter((s) => s.completion === "missed").length;
  return (
    <section className={card}>
      <p className="text-xs text-ink/55">This week</p>
      <h2 className="mt-1 font-display text-lg text-ink">
        {done} of {tracked.length} done
        {missed > 0 ? (
          <span className="text-ember"> · {missed} missed</span>
        ) : null}
      </h2>
      <ul className="mt-3 divide-y divide-ink/10">
        {week.map((day) => (
          <li
            key={day.date}
            className={`py-2.5 ${day.isToday ? "font-semibold" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink">
                {dayShort(day.dayOfWeek)}{" "}
                <span className="font-normal text-ink/50">
                  {formatShortDate(day.date)}
                </span>
              </span>
              {day.kneeStatus ? (
                <span className="text-xs font-normal text-ink/55">
                  {KNEE_TAG[day.kneeStatus]}
                </span>
              ) : null}
            </div>
            <ul className="mt-1 space-y-0.5">
              {day.sessions.map((s) => {
                const c = COMPLETION[s.completion];
                return (
                  <li
                    key={s.id}
                    className={`flex justify-between gap-2 text-sm font-normal ${s.visible ? "text-ink/80" : "text-ink/35"}`}
                  >
                    <span className="min-w-0 truncate">
                      {s.name}
                      {!s.visible ? " (locked)" : ""}
                    </span>
                    {s.visible && c ? (
                      <span className={`shrink-0 text-xs ${c.tone}`}>
                        {c.label}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgramMilestones({
  milestones,
}: {
  milestones: ProgramPageData["milestones"];
}) {
  return (
    <section className={card}>
      <h2 className="font-display text-lg text-ink">Milestones</h2>
      <ul className="mt-3 divide-y divide-ink/10">
        {milestones.map((m) => (
          <li
            key={m.label}
            className={`flex justify-between gap-3 py-2 text-sm ${m.past ? "text-ink/45" : "text-ink"}`}
          >
            <span className="min-w-0">
              {m.label}
              <span className="ml-1.5 text-xs text-ink/50">wk {m.week}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatShortDate(m.date)}
              {m.date.slice(0, 4) !== "2026" ? `, ${m.date.slice(0, 4)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgramProgress({
  hardSets,
  hardSetTarget,
  progress,
}: Pick<ProgramPageData, "hardSets" | "hardSetTarget" | "progress">) {
  const current = hardSets[hardSets.length - 1];
  const max = Math.max(
    hardSetTarget.max,
    ...hardSets.map((w) => w.count.total),
  );
  return (
    <section className={card}>
      <h2 className="font-display text-lg text-ink">Progress</h2>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-ink">Hard leg sets this week</p>
          <p className="text-sm font-semibold tabular-nums text-ink">
            {current?.count.total ?? 0}
            <span className="font-normal text-ink/55">
              {" "}
              / {hardSetTarget.min}–{hardSetTarget.max}
            </span>
          </p>
        </div>
        {current && current.count.byMuscle.quads != null ? (
          <p className="text-xs text-ink/55">
            Quads {current.count.byMuscle.quads}
          </p>
        ) : null}
        <ol
          className="mt-3 flex h-20 items-end gap-1.5"
          aria-label="Hard leg sets by week"
        >
          {hardSets.map((w) => {
            const band = hardSetBand(w.count.total, hardSetTarget);
            return (
              <li
                key={w.week}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={`w-full rounded-t ${band === "on" ? "bg-pine" : band === "over" ? "bg-ember" : "bg-ink/25"}`}
                  style={{
                    height: `${Math.max(4, (w.count.total / max) * 64)}px`,
                  }}
                  title={`${w.count.total} sets`}
                />
                <span className="text-[0.65rem] text-ink/50">{w.week}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-1 text-[0.7rem] text-ink/45">
          Post-op week. Working rep sets at RIR 4 or less; per-leg lifts count
          the left leg.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm text-ink">Top load per session</p>
        {progress.length === 0 ? (
          <p className="text-xs text-ink/55">
            Shows up after the first logged leg session.
          </p>
        ) : (
          progress.map((p) => {
            const last = p.points[p.points.length - 1];
            const lsi = p.force
              ? limbSymmetryPct(last?.leftPeakNewtons, last?.rightPeakNewtons)
              : p.perLeg
                ? limbSymmetryPct(last?.leftLoad, last?.rightLoad)
                : null;
            return (
              <div
                key={p.name}
                className="rounded-2xl border border-ink/10 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-ink">
                    {p.name}
                  </p>
                  {lsi != null ? (
                    <p className="shrink-0 text-xs text-ink/60">L/R {lsi}%</p>
                  ) : null}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {p.points.map((pt) => (
                    <li
                      key={pt.date}
                      className="flex justify-between gap-2 text-xs tabular-nums text-ink/70"
                    >
                      <span>{formatShortDate(pt.date)}</span>
                      <span>
                        {p.force
                          ? `L ${pt.leftPeakNewtons ?? "–"} N · R ${pt.rightPeakNewtons ?? "–"} N`
                          : p.perLeg
                            ? `L ${pt.leftLoad ?? "–"} · R ${pt.rightLoad ?? "–"} lb`
                            : `${pt.load ?? "–"} lb`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function ProgramGatesSummary({
  gates,
}: {
  gates: ProgramPageData["gates"];
}) {
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-ink">Gates</h2>
        <Link
          href="/settings#gates"
          className="text-sm font-semibold text-pine"
        >
          Edit →
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-ink/10">
        {gates.map((g) => (
          <li
            key={g.gateKey}
            className="flex justify-between gap-3 py-2 text-sm"
          >
            <span className="min-w-0 text-ink">{g.label}</span>
            <span
              className={`shrink-0 text-xs ${g.clearedOn ? "text-pine" : "text-ink/50"}`}
            >
              {g.clearedOn
                ? `Cleared ${formatShortDate(g.clearedOn)}`
                : "Not cleared"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
