import {
  createBodyMetricAction,
  updateBodyMetricAction,
} from "../actions";
import { getBodyPageData } from "../server";
import { BodyMetricList } from "./body-metric-list";
import { BodyQuickForm } from "./body-quick-form";
import { BodySummaryCards } from "./body-summary-cards";
import { BodyTrendSection } from "./body-trend-section";

type BodyScreenProps = {
  editMetricId?: string;
};

export async function BodyScreen({ editMetricId }: BodyScreenProps) {
  const data = await getBodyPageData(editMetricId);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Measurements
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">Body</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Track your weight and measurements over time. Log the essentials
          quickly — body fat and muscle mass are optional.
        </p>
      </section>

      <BodySummaryCards summary={data.summary} />

      <BodyQuickForm
        mode={data.editingMetric ? "edit" : "create"}
        metric={data.editingMetric}
        action={data.editingMetric ? updateBodyMetricAction : createBodyMetricAction}
        formError={data.formError}
      />

      <BodyTrendSection
        weightTrend={data.weightTrend}
        waistTrend={data.waistTrend}
        bodyFatTrend={data.bodyFatTrend}
      />

      <BodyMetricList metrics={data.metrics} />
    </div>
  );
}
