import Link from "next/link";
import type { TrainingWeekData } from "../types";

type TrainingWeekCardProps = {
  data: TrainingWeekData;
};

function formatWeekRange(weekStart: string, weekEnd: string) {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(new Date(`${weekStart}T12:00:00`))} – ${fmt.format(new Date(`${weekEnd}T12:00:00`))}`;
}

type StatProps = {
  label: string;
  value: string;
  sub?: string;
  href: string;
};

function Stat({ label, value, sub, href }: StatProps) {
  return (
    <Link
      href={href}
      className="group rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4 transition hover:border-pine/30 hover:bg-pine/5"
    >
      <div className="text-xs uppercase tracking-[0.2em] text-ink/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
      {sub ? <div className="mt-1.5 text-sm text-ink/60">{sub}</div> : null}
    </Link>
  );
}

export function TrainingWeekCard({ data }: TrainingWeekCardProps) {
  const { weekStart, weekEnd, liftsCompleted, ridesCompleted, zone2Minutes, totalMinutes } = data;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            This week
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {formatWeekRange(weekStart, weekEnd)}
          </h2>
        </div>
        {totalMinutes > 0 ? (
          <div className="rounded-full border border-pine/20 bg-pine/10 px-4 py-2 text-sm font-semibold text-pine">
            {totalMinutes} min active
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <Stat
          label="Lifts"
          value={String(liftsCompleted)}
          sub="sessions logged"
          href="/strength"
        />
        <Stat
          label="Cardio"
          value={String(ridesCompleted)}
          sub="sessions completed"
          href="/cardio"
        />
        <Stat
          label="Zone 2"
          value={`${zone2Minutes}`}
          sub="minutes this week"
          href="/cardio"
        />
      </div>
    </section>
  );
}
