import { getInsightsData } from "../server";
import { InsightsList } from "./insights-list";

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

      <InsightsList initialInsights={insights} />
    </div>
  );
}
