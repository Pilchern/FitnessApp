import Link from "next/link";
import type { ProgramPageData } from "../types";
import {
  dayShort,
  formatShortDate,
  hardSetBand,
  limbSymmetryPct,
  SKIP_LABELS,
  type SessionCompletion,
} from "../helpers";

function yearSuffix(date: string) {
  return date.slice(0, 4) !== "2026" ? `, ${date.slice(0, 4)}` : "";
}

const card =
  "rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6";

/** Reference material: one row until opened. */
function Fold({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-[1.75rem] border border-ink/10 bg-white shadow-panel">
      <summary className="flex h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {meta ? (
            <span className="ml-2 font-normal text-ink/50">{meta}</span>
          ) : null}
        </span>
        <span className="text-ink/50 group-open:hidden">+</span>
        <span className="hidden text-ink/50 group-open:inline">−</span>
      </summary>
      <div className="border-t border-ink/10 px-5 pb-5 pt-2 sm:px-6">
        {children}
      </div>
    </details>
  );
}

const COMPLETION: Record<
  SessionCompletion,
  { label: string; tone: string } | null
> = {
  skipped: { label: "Skipped", tone: "text-ember" },
  stopped: { label: "Stopped", tone: "text-ember font-semibold" },
  done: { label: "Done", tone: "text-pine" },
  missed: { label: "Missed", tone: "text-ember font-semibold" },
  today: { label: "Today", tone: "text-pine" },
  planned: null,
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
  const skipped = tracked.filter(
    (s) => s.completion === "skipped" || s.completion === "stopped",
  ).length;
  return (
    <section className={card}>
      <p className="text-xs text-ink/55">This week</p>
      <h2 className="mt-1 font-display text-lg text-ink">
        {done} of {tracked.length} done
        {missed > 0 ? (
          <span className="text-ember"> · {missed} missed</span>
        ) : null}
        {skipped > 0 ? (
          <span className="text-ember"> · {skipped} skipped</span>
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
                        {s.makeUp ? (
                          <Link
                            href={s.makeUp.href}
                            className="mr-2 font-semibold text-pine underline-offset-2 hover:underline"
                          >
                            Make up
                          </Link>
                        ) : null}
                        {c.label}
                        {s.madeUpOn
                          ? ` · made up ${dayShort(new Date(`${s.madeUpOn}T12:00:00Z`).getUTCDay())}`
                          : s.outcome && s.completion !== "done"
                            ? ` · ${SKIP_LABELS[s.outcome.reason]}`
                            : ""}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <Link
        href="/program/review"
        className="mt-2 flex items-center justify-between border-t border-ink/10 pt-3 text-sm text-ink/70 hover:text-pine"
      >
        <span>Weekly review</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export function ProgramMilestones({
  milestones,
}: {
  milestones: ProgramPageData["milestones"];
}) {
  const next = milestones.find((m) => !m.past);
  return (
    <Fold
      title="Milestones"
      meta={next ? `next: ${next.label}, ${formatShortDate(next.date)}` : null}
    >
      <ul className="divide-y divide-ink/10">
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
              {yearSuffix(m.date)}
            </span>
          </li>
        ))}
      </ul>
    </Fold>
  );
}

export function ProgramProgress({
  hardSets,
  hardSetTarget,
  progress,
}: Pick<ProgramPageData, "hardSets" | "hardSetTarget" | "progress">) {
  const current = hardSets[hardSets.length - 1];
  const quads = (w: (typeof hardSets)[number]) => w.count.quadSets;
  const max = Math.max(hardSetTarget.max, ...hardSets.map(quads));
  return (
    <section className={card}>
      <h2 className="font-display text-lg text-ink">Progress</h2>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-ink">Hard quad sets this week</p>
          <p className="text-sm font-semibold tabular-nums text-ink">
            {current ? quads(current) : 0}
            <span className="font-normal text-ink/55">
              {" "}
              / {hardSetTarget.min}–{hardSetTarget.max}
            </span>
          </p>
        </div>
        <p className="text-xs text-ink/55">
          All hard leg sets {current?.count.total ?? 0}
        </p>
        {hardSets.length >= 2 ? (
          <ol
            className="mt-3 flex h-20 items-end gap-1.5"
            aria-label="Hard quad sets by week"
          >
            {hardSets.map((w) => {
              const band = hardSetBand(quads(w), hardSetTarget);
              return (
                <li
                  key={w.week}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className={`w-full rounded-t ${band === "on" ? "bg-pine" : band === "over" ? "bg-ember" : "bg-ink/25"}`}
                    style={{
                      height: `${Math.max(4, (quads(w) / max) * 64)}px`,
                    }}
                    title={`${quads(w)} quad sets`}
                  />
                  <span className="text-[0.65rem] text-ink/50">{w.week}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        <p className="mt-1 text-[0.7rem] text-ink/45">
          Working rep sets at or under the hard-set RIR; per-leg lifts count the
          left leg.
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
                          : p.perLeg &&
                              (pt.leftLoad != null || pt.rightLoad != null)
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
  const cleared = gates.filter((g) => g.clearedOn).length;
  return (
    <Fold title="Gates" meta={`${cleared} of ${gates.length} cleared`}>
      <ul className="divide-y divide-ink/10">
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
                : g.earliestOn
                  ? `Earliest ${formatShortDate(g.earliestOn)}${yearSuffix(g.earliestOn)}`
                  : "Not cleared"}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/settings#gates"
        className="mt-2 inline-block text-sm font-semibold text-pine"
      >
        Edit gates →
      </Link>
    </Fold>
  );
}

/** The program's global rules (Settings › Program targets edits them). */
export function ProgramRules({
  rules,
  version,
}: {
  rules: string[];
  version: string | null;
}) {
  if (rules.length === 0) return null;
  return (
    <Fold title="Rules" meta={rules.length}>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/80">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink/50">
        <span>{version ?? ""}</span>
        <a href="/api/program/calendar" className="font-semibold text-pine">
          Calendar (.ics)
        </a>
      </div>
    </Fold>
  );
}
