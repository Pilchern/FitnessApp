import {
  MIN_SESSIONS_FOR_TREND,
  topSetScore,
  type StrengthProgressionSummary,
  type TopSetPoint,
} from "@fitness-app/application";
import { formatTopSet } from "../helpers";

type StrengthProgressionSummaryProps = {
  summaries: StrengthProgressionSummary[];
  title?: string;
  description?: string;
  /** Render folded behind a <details>, for the busy /strength page. */
  collapsible?: boolean;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-full" aria-hidden>
      <path
        d={d}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
      />
      {pts.map((pt, i) => {
        const [x, y] = pt.split(",").map(Number);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="white"
            strokeWidth="2"
            className={strokeClass}
          />
        );
      })}
    </svg>
  );
}

// ─── Trend cards ──────────────────────────────────────────────────────────────

type TrendCardProps = {
  label: string;
  values: number[];
  /** Change from first to latest that counts as real, not noise. */
  threshold: number;
  /** False under 3 sessions: show the numbers, but colour nothing. */
  judged: boolean;
  unit?: string;
};

function TrendCard({ label, values, threshold, judged, unit }: TrendCardProps) {
  if (values.length < 2) return null;

  const latest = values[values.length - 1];
  const delta = Math.round((latest - values[0]) * 10) / 10;
  const tone = !judged
    ? "text-ink/50"
    : delta > threshold
      ? "text-pine"
      : delta < -threshold
        ? "text-ember"
        : "text-ink/50";

  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-white/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
          {label}
        </div>
        <div className={`text-xs font-semibold ${tone}`}>
          {delta > 0 ? "+" : ""}
          {delta}
        </div>
      </div>
      <div className="mt-1 text-lg font-semibold text-ink">
        {latest.toLocaleString()}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-ink/50">{unit}</span>
        ) : null}
      </div>
      <Sparkline
        values={values}
        strokeClass={
          tone === "text-ember"
            ? "stroke-ember"
            : tone === "text-pine"
              ? "stroke-pine"
              : "stroke-ink/40"
        }
      />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(summary: StrengthProgressionSummary) {
  if (summary.kind === "bodyweight") {
    return { label: "Bodyweight", tone: "neutral" as const };
  }
  if (summary.kind === "timed") {
    return { label: "Timed", tone: "neutral" as const };
  }
  if (summary.sessionCount < MIN_SESSIONS_FOR_TREND) {
    return { label: "New", tone: "neutral" as const };
  }
  if (summary.isPersonalRecord) {
    return { label: "PR", tone: "good" as const };
  }
  if (summary.stall.stalled) {
    return { label: "Stall", tone: "bad" as const };
  }
  return { label: "Up", tone: "good" as const };
}

const BADGE_TONES = {
  neutral: "border-ink/10 bg-white/70 text-ink/60",
  good: "border-pine/20 bg-pine/10 text-pine",
  bad: "border-ember/20 bg-ember/10 text-ember",
};

function formatPoint(point: TopSetPoint) {
  return formatTopSet(point.weight, point.reps, point.durationSeconds ?? null);
}

// ─── Main section ─────────────────────────────────────────────────────────────

function SummaryCards({
  summaries,
}: {
  summaries: StrengthProgressionSummary[];
}) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm leading-6 text-ink/75">
        Trends show up after 3 sessions of the same exercise.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {summaries.map((summary) => {
        const badge = statusBadge(summary);
        const weighted = summary.kind === "weighted";
        const judged =
          weighted && summary.sessionCount >= MIN_SESSIONS_FOR_TREND;
        const scores = summary.topSetHistory.map(topSetScore);
        const volumes = summary.volumeHistory.map((p) => p.totalVolume);

        return (
          <article
            key={summary.exerciseName}
            className="rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink">
                  {summary.exerciseName}
                </h3>
                <p className="mt-0.5 text-sm text-ink/70">
                  {summary.latestTopSet
                    ? formatPoint(summary.latestTopSet)
                    : "--"}
                  {summary.previousTopSet ? (
                    <span className="text-ink/45">
                      {" "}
                      · Prev {formatPoint(summary.previousTopSet)}
                    </span>
                  ) : null}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] ${BADGE_TONES[badge.tone]}`}
              >
                {badge.label}
              </span>
            </div>

            {weighted && scores.length >= 2 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TrendCard
                  label="Est. 1RM"
                  unit="lb"
                  values={scores}
                  threshold={Math.max(2.5, Math.abs(scores[0]) * 0.015)}
                  judged={judged}
                />
                <TrendCard
                  label="Volume"
                  unit="lb"
                  values={volumes}
                  threshold={Math.max(1, Math.abs(volumes[0]) * 0.05)}
                  judged={judged}
                />
              </div>
            ) : null}

            {judged ? (
              <p className="mt-3 text-xs leading-5 text-ink/60">
                {summary.stall.explanation}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function StrengthProgressionSummarySection({
  summaries,
  title = "Progression",
  description,
  collapsible = false,
}: StrengthProgressionSummaryProps) {
  if (collapsible) {
    return (
      <details className="group rounded-[1.75rem] border border-ink/10 bg-white/80 shadow-panel">
        <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-6 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>
            {title}
            <span className="ml-2 font-normal text-ink/50">
              {summaries.length}
            </span>
          </span>
          <span className="text-ink/50 group-open:hidden">+</span>
          <span className="hidden text-ink/50 group-open:inline">−</span>
        </summary>
        <div className="border-t border-ink/10 p-4 sm:p-6">
          <SummaryCards summaries={summaries} />
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-ink/70">{description}</p>
      ) : null}
      <div className="mt-4">
        <SummaryCards summaries={summaries} />
      </div>
    </section>
  );
}
