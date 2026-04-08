import { InsightCard } from "@/components/shared/insight-card";
import { getInsightsData } from "../server";

export async function InsightsScreen() {
  const { insights } = await getInsightsData();

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Coaching
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">Insights</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Personalised observations based on your training, recovery, and
          body data. Each insight is grounded in what you&apos;ve actually logged.
        </p>
      </section>

      {insights.length === 0 ? (
        <section className="rounded-[1.75rem] border border-dashed border-pine/30 bg-pine/5 p-8 text-center shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">All clear</p>
          <h2 className="mt-3 font-display text-3xl text-ink">No patterns to flag right now.</h2>
          <p className="mt-3 text-sm leading-6 text-ink/75">
            Keep logging and check back after your next week.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </section>
      )}
    </div>
  );
}
