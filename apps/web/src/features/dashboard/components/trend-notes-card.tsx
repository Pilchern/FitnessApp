import Link from "next/link";
import type { PersistedInsight, TrendNote } from "@fitness-app/application";

type TrendNotesCardProps = {
  notes: TrendNote[];
  insights: PersistedInsight[];
};

const TONE_DOT: Record<TrendNote["tone"], string> = {
  positive: "bg-pine",
  neutral: "bg-ink/30",
  attention: "bg-ember",
};

function insightTone(insight: PersistedInsight): TrendNote["tone"] {
  const severity = insight.evidence["severity"];
  if (severity === "warning" || severity === "caution") return "attention";
  if (severity === "positive") return "positive";
  return "neutral";
}

/**
 * Deterministic "what changed" notes plus any active coaching insights.
 * Hidden when there is nothing worth saying.
 */
export function TrendNotesCard({ notes, insights }: TrendNotesCardProps) {
  if (notes.length === 0 && insights.length === 0) return null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg text-ink">What changed</h2>
        {insights.length > 0 ? (
          <Link
            href="/insights"
            className="text-sm font-semibold text-pine hover:underline"
          >
            All insights
          </Link>
        ) : null}
      </div>
      <ul className="mt-3 space-y-3">
        {insights.map((insight) => (
          <li key={insight.id} className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[insightTone(insight)]}`}
            />
            <span className="text-ink/80">
              <span className="font-semibold text-ink">{insight.title}.</span>{" "}
              {insight.body}
            </span>
          </li>
        ))}
        {notes.map((note) => (
          <li key={note.key} className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[note.tone]}`}
            />
            <span className="text-ink/80">{note.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
