import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import type { WeeklyReviewData } from "../types";
import { formatShortDate } from "../helpers";
import { Scorecard } from "./adherence";
import { CopySummaryButton, WeeklyCheckinForm } from "./weekly-review-client";

const card =
  "rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6";

function fmt(value: number | null | undefined, unit = "") {
  return value == null ? "–" : `${value}${unit}`;
}

function Row({
  label,
  value,
  flag = false,
}: {
  label: string;
  value: string;
  flag?: boolean;
}) {
  return (
    <li className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 text-ink/75">{label}</span>
      <span
        className={`shrink-0 tabular-nums ${flag ? "font-semibold text-ember" : "text-ink"}`}
      >
        {value}
      </span>
    </li>
  );
}

/** Weekly LSI (higher is better) and walking asymmetry (lower) with target lines. */
function MarkerTrend({
  points,
  pick,
  targets,
  min,
  max,
  label,
}: {
  points: WeeklyReviewData["trend"];
  pick: (p: WeeklyReviewData["trend"][number]) => number | null;
  targets: number[];
  min: number;
  max: number;
  label: string;
}) {
  const data = points.filter((p) => pick(p) != null);
  const height = 80;
  const width = 300;
  const pad = 24;
  const y = (v: number) =>
    height - ((Math.min(Math.max(v, min), max) - min) / (max - min)) * height;
  const x = (i: number) =>
    data.length <= 1
      ? width / 2
      : (i / (data.length - 1)) * (width - 2 * pad) + pad;
  return (
    <figure>
      <figcaption className="text-xs text-ink/60">{label}</figcaption>
      {data.length === 0 ? (
        <p className="mt-1 text-xs text-ink/45">No entries yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height + 14}`}
          className="mt-1 h-auto w-full"
          role="img"
          aria-label={`${label}: ${data.map((p) => `week ${p.week} ${pick(p)}%`).join(", ")}`}
        >
          {targets.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={width}
                y1={y(t)}
                y2={y(t)}
                stroke="currentColor"
                className="text-ink/20"
                strokeDasharray="4 4"
              />
              <text
                x={width - 2}
                y={y(t) - 2}
                textAnchor="end"
                className="fill-ink/45 text-[10px]"
              >
                {t}%
              </text>
            </g>
          ))}
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="text-pine"
            points={data.map((p, i) => `${x(i)},${y(pick(p)!)}`).join(" ")}
          />
          {data.map((p, i) => (
            <g key={p.week}>
              <circle cx={x(i)} cy={y(pick(p)!)} r={3} className="fill-pine" />
              <text
                x={x(i)}
                y={height + 12}
                textAnchor="middle"
                className="fill-ink/50 text-[10px]"
              >
                wk {p.week}
              </text>
            </g>
          ))}
        </svg>
      )}
    </figure>
  );
}

export function WeeklyReviewScreen({ data }: { data: WeeklyReviewData }) {
  const a = data.adherence;
  const n = data.nutrition;
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Weekly review"
        subtitle={`Post-op week ${data.week}${data.blockName ? ` · ${data.blockName}` : ""} · ${formatShortDate(data.weekStart)}–${formatShortDate(data.weekEnd)}`}
      />

      <nav className="flex justify-between px-1 text-sm">
        {data.week > data.firstWeek ? (
          <Link
            href={`/program/review?week=${data.week - 1}`}
            className="text-pine"
          >
            ← Week {data.week - 1}
          </Link>
        ) : (
          <span />
        )}
        {data.week < data.currentWeek ? (
          <Link
            href={`/program/review?week=${data.week + 1}`}
            className="text-pine"
          >
            Week {data.week + 1} →
          </Link>
        ) : null}
      </nav>

      <section className={`${card} border-pine/30 bg-pine/5`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">
          Next week&apos;s focus
        </p>
        <h2 className="mt-1 font-display text-xl text-ink">
          {data.focus ? data.focus.label : "Everything on target"}
        </h2>
        <p className="mt-1 text-sm text-ink/75">
          {data.focus
            ? `${fmt(data.focus.actual)} vs ${fmt(data.focus.target)}. ${data.focus.advice}`
            : "Keep the same plan next week."}
        </p>
        {data.nextBlock ? (
          <p className="mt-2 text-xs text-ink/60">
            Next block: {data.nextBlock.name} on{" "}
            {formatShortDate(data.nextBlock.date)}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <section className={`${card} space-y-3`}>
          <h2 className="font-display text-lg text-ink">Adherence</h2>
          <Scorecard adherence={a} />
          <ul className="divide-y divide-ink/10">
            <Row
              label="Streaks"
              value={`${data.liftStreakWeeks} full leg weeks · ${data.romStreakDays} ROM days`}
            />
            <Row
              label="Knee checks"
              value={`${data.readiness.normal} normal · ${data.readiness.hold} repeat · ${data.readiness.kneeOff} off`}
              flag={data.readiness.kneeOff > 0}
            />
            <Row
              label="Not checked"
              value={`${data.readiness.unchecked} days`}
            />
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-display text-lg text-ink">Legs</h2>
          <ul className="mt-2 divide-y divide-ink/10">
            <Row
              label="Hard quad sets"
              value={`${data.quadSets.done} / ${data.quadSets.min}–${data.quadSets.max}`}
              flag={data.quadSets.done < data.quadSets.min}
            />
            {data.lifts.map((l) => (
              <Row
                key={l.name}
                label={l.name}
                value={
                  l.perLeg
                    ? `L ${fmt(l.thisWeek.left)} · R ${fmt(l.thisWeek.right)} (was L ${fmt(l.lastWeek.left)} · R ${fmt(l.lastWeek.right)})`
                    : `${fmt(l.thisWeek.load)} lb (was ${fmt(l.lastWeek.load)})`
                }
              />
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className="font-display text-lg text-ink">Fuel, body, sleep</h2>
          {data.surplusBanner ? (
            <p className="mt-2 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
              Trim the surplus. Never cut protein.
            </p>
          ) : null}
          <ul className="mt-2 divide-y divide-ink/10">
            <Row
              label={`Protein avg (${n.daysLogged} days logged)`}
              value={`${fmt(n.proteinAvg, " g")} / ${fmt(n.proteinTarget, " g")}`}
              flag={n.proteinFlag}
            />
            <Row
              label="Calories avg"
              value={`${fmt(n.caloriesAvg)} / ${fmt(n.caloriesTargetAvg)}`}
            />
            <Row
              label="Creatine · 50 g by 9 AM"
              value={`${n.creatineDays}/7 · ${n.protein50Days}/7`}
            />
            <Row
              label="Weight, 7-day avg"
              value={`${fmt(data.weight.sevenDayAvgLb, " lb")} (${data.weight.weekOverWeekLb != null && data.weight.weekOverWeekLb > 0 ? "+" : ""}${fmt(data.weight.weekOverWeekLb)} lb)`}
            />
            <Row
              label={`Sleep avg (${data.sleep.nights} nights)`}
              value={`${fmt(data.sleep.avgHours, " h")}${data.sleep.avgQuality != null ? ` · quality ${data.sleep.avgQuality}` : ""}`}
              flag={data.sleep.flag}
            />
          </ul>
        </section>

        <section className={`${card} space-y-4`}>
          <h2 className="font-display text-lg text-ink">Your entries</h2>
          <WeeklyCheckinForm
            key={data.weekStart}
            weekStart={data.weekStart}
            checkin={data.checkin}
            defaultScheduled={a.pt.scheduled ?? 2}
          />
          <MarkerTrend
            label="Quad LSI %"
            points={data.trend}
            pick={(p) => p.quadLsiPct}
            targets={data.targets.lsi}
            min={40}
            max={100}
          />
          <MarkerTrend
            label="Walking asymmetry %"
            points={data.trend}
            pick={(p) => p.walkingAsymmetryPct}
            targets={[data.targets.asymmetry]}
            min={0}
            max={25}
          />
        </section>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-lg text-ink">For LifeOS</h2>
        <CopySummaryButton text={data.summaryText} />
        <a
          href="/api/program/calendar"
          className="block text-center text-sm font-semibold text-pine underline"
        >
          Download this block&apos;s sessions (.ics)
        </a>
      </section>
    </div>
  );
}
