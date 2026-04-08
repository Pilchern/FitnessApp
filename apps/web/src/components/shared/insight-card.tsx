import type { Insight } from "@fitness-app/domain";

type InsightCardProps = {
  insight: Insight;
};

const badgeStyles: Record<Insight["severity"], string> = {
  warning: "border-ember/20 bg-ember/10 text-ember",
  caution: "border-amber-300/40 bg-amber-50 text-amber-700",
  info: "border-pine/20 bg-pine/10 text-pine",
  positive: "border-pine/20 bg-pine/10 text-pine",
};

const borderStyles: Record<Insight["severity"], string> = {
  warning: "border-l-4 border-l-ember bg-ember/5",
  caution: "border-l-4 border-l-amber-400 bg-amber-50",
  info: "border-l-4 border-l-pine/30 bg-pine/5",
  positive: "border-l-4 border-l-pine/30 bg-pine/5",
};

const severityLabels: Record<Insight["severity"], string> = {
  warning: "Warning",
  caution: "Caution",
  info: "Info",
  positive: "Positive",
};

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <article
      className={`rounded-[1.5rem] border border-ink/10 bg-white/80 p-5 shadow-panel ${borderStyles[insight.severity]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{insight.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/75">{insight.explanation}</p>
        </div>
        <div
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${badgeStyles[insight.severity]}`}
        >
          {severityLabels[insight.severity]}
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-ink/10 bg-sand/55 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
          Recommended next action
        </div>
        <p className="mt-2 text-sm leading-6 text-ink">{insight.recommendedNextAction}</p>
      </div>
    </article>
  );
}
