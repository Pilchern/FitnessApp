import type { TopSetPoint, VolumeTrendPoint, StrengthProgressionSummary } from "@fitness-app/application";
import { formatTopSet } from "../helpers";

type StrengthProgressionSummaryProps = {
  summaries: StrengthProgressionSummary[];
  title?: string;
  description?: string;
};

// ─── Mini sparkline ───────────────────────────────────────────────────────────

type SparklineProps = {
  values: number[];
  strokeClass: string;
};

function Sparkline({ values, strokeClass }: SparklineProps) {
  if (values.length < 2) return null;

  const w = 200;
  const h = 48;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const dw = w - pad * 2;
  const dh = h - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (dw * i) / (values.length - 1);
    const y = pad + dh - ((v - min) / range) * dh;
    return `${x},${y}`;
  });

  const d = `M ${pts.join(" L ")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" aria-hidden>
      <path d={d} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={strokeClass} />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill="white" strokeWidth="2" className={strokeClass} />;
      })}
    </svg>
  );
}

// ─── Top-set sparkline card ───────────────────────────────────────────────────

function TopSetChart({ history }: { history: TopSetPoint[] }) {
  const values = history
    .map((p) => p.estimatedOneRepMax ?? p.weight ?? p.reps ?? null)
    .filter((v): v is number => v != null);

  if (values.length < 2) return null;

  const latest = values[values.length - 1];
  const first = values[0];
  const delta = Math.round((latest - first) * 10) / 10;
  const prefix = delta > 0 ? "+" : "";

  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-white/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Top set</div>
        <div className={`text-xs font-semibold ${delta > 0.5 ? "text-pine" : delta < -0.5 ? "text-ember" : "text-ink/50"}`}>
          {prefix}{delta}
        </div>
      </div>
      <div className="mt-2 text-xl font-semibold text-ink">{latest}</div>
      <div className="mt-3">
        <Sparkline values={values} strokeClass={delta >= 0 ? "stroke-pine" : "stroke-ember"} />
      </div>
      <div className="mt-1 text-xs text-ink/50">{history.length} sessions</div>
    </div>
  );
}

// ─── Volume sparkline card ────────────────────────────────────────────────────

function VolumeChart({ history }: { history: VolumeTrendPoint[] }) {
  const values = history.map((p) => p.totalVolume);

  if (values.length < 2) return null;

  const latest = values[values.length - 1];
  const first = values[0];
  const delta = Math.round((latest - first) * 10) / 10;
  const prefix = delta > 0 ? "+" : "";

  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-white/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Volume</div>
        <div className={`text-xs font-semibold ${delta > 1 ? "text-pine" : delta < -1 ? "text-ember" : "text-ink/50"}`}>
          {prefix}{delta}
        </div>
      </div>
      <div className="mt-2 text-xl font-semibold text-ink">{latest}</div>
      <div className="mt-3">
        <Sparkline values={values} strokeClass={delta >= 0 ? "stroke-pine" : "stroke-ember"} />
      </div>
      <div className="mt-1 text-xs text-ink/50">{history.length} sessions</div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function StrengthProgressionSummarySection({
  summaries,
  title = "Progression",
  description = "Strength trends for your main exercises.",
}: StrengthProgressionSummaryProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Trends
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{description}</p>
      </div>

      {summaries.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-ink/75">
          Log a few sessions with the same exercises and trends will appear here.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {summaries.map((summary) => {
            const hasCharts =
              summary.topSetHistory.length >= 2 || summary.volumeHistory.length >= 2;

            return (
              <article
                key={summary.exerciseName}
                className="rounded-[1.5rem] border border-ink/10 bg-sand/50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">
                        {summary.exerciseName}
                      </h3>
                      {summary.isPersonalRecord ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                          PR
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink/70">
                      Latest: {formatTopSet(
                        summary.latestTopSet?.weight ?? null,
                        summary.latestTopSet?.reps ?? null,
                      )}
                      {summary.previousTopSet ? (
                        <span className="text-ink/45">
                          {" "}· Prev: {formatTopSet(
                            summary.previousTopSet.weight,
                            summary.previousTopSet.reps,
                          )}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      summary.stall.stalled
                        ? "border-ember/20 bg-ember/10 text-ember"
                        : "border-pine/20 bg-pine/10 text-pine"
                    }`}
                  >
                    {summary.stall.stalled ? "Stall" : "Moving"}
                  </div>
                </div>

                {hasCharts ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <TopSetChart history={summary.topSetHistory} />
                    <VolumeChart history={summary.volumeHistory} />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-ink/10 bg-white/70 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Top set trend</div>
                      <div className="mt-2 text-lg font-semibold capitalize text-ink">
                        {summary.topSetTrend}
                      </div>
                    </div>
                    <div className="rounded-[1.25rem] border border-ink/10 bg-white/70 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Volume trend</div>
                      <div className="mt-2 text-lg font-semibold capitalize text-ink">
                        {summary.volumeTrend}
                      </div>
                    </div>
                  </div>
                )}

                <p className="mt-4 text-xs leading-5 text-ink/60">
                  {summary.stall.explanation}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
