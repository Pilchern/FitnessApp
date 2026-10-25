import type { MacroWeek } from "@fitness-app/application";

function tone(avg: number | null, target: number | null) {
  if (avg == null || target == null) return "text-ink";
  const ratio = avg / target;
  return ratio >= 0.95 && ratio <= 1.05
    ? "text-pine"
    : ratio < 0.9 || ratio > 1.1
      ? "text-ember"
      : "text-ink";
}

/** 7-day averages per macro against the daily target. */
export function MacroAveragesCard({ week }: { week: MacroWeek }) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-5 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        7-day averages vs target
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {week.daysLogged} of 7 days with calories logged ({week.start} to{" "}
        {week.end}).
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {week.macros.map((m) => (
          <div
            key={m.key}
            className="rounded-2xl border border-ink/10 bg-white px-3 py-2"
          >
            <p className="text-[0.7rem] text-ink/55">{m.label}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${tone(m.avg, m.target)}`}
            >
              {m.avg ?? "–"}
              <span className="text-sm font-normal text-ink/50">
                /{m.target ?? "–"}
              </span>
            </p>
            <p className="text-[0.7rem] text-ink/45">
              {m.unit} · {m.daysWithValue}d
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
