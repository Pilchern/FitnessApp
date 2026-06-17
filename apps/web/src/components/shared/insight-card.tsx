import type { InsightSeverity } from "@fitness-app/domain";
import type { PersistedInsight } from "@fitness-app/application";

type InsightCardProps = {
  insight: PersistedInsight;
};

const badgeStyles: Record<InsightSeverity, string> = {
  warning: "border-ember/20 bg-ember/10 text-ember",
  caution: "border-amber-300/40 bg-amber-50 text-amber-700",
  info: "border-pine/20 bg-pine/10 text-pine",
  positive: "border-pine/20 bg-pine/10 text-pine",
};

const borderStyles: Record<InsightSeverity, string> = {
  warning: "border-l-4 border-l-ember bg-ember/5",
  caution: "border-l-4 border-l-amber-400 bg-amber-50",
  info: "border-l-4 border-l-pine/30 bg-pine/5",
  positive: "border-l-4 border-l-pine/30 bg-pine/5",
};

const severityLabels: Record<InsightSeverity, string> = {
  warning: "Warning",
  caution: "Caution",
  info: "Info",
  positive: "Positive",
};

const VALID_SEVERITIES = new Set<InsightSeverity>(["warning", "caution", "info", "positive"]);

function getSeverity(insight: PersistedInsight): InsightSeverity {
  const fromEvidence = insight.evidence["severity"];
  if (typeof fromEvidence === "string" && VALID_SEVERITIES.has(fromEvidence as InsightSeverity)) {
    return fromEvidence as InsightSeverity;
  }
  return "info";
}

export function InsightCard({ insight }: InsightCardProps) {
  const severity = getSeverity(insight);

  return (
    <article
      className={`rounded-[1.5rem] border border-ink/10 bg-white/80 p-5 shadow-panel ${borderStyles[severity]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{insight.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/75">{insight.body}</p>
        </div>
        <div
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${badgeStyles[severity]}`}
        >
          {severityLabels[severity]}
        </div>
      </div>
    </article>
  );
}
