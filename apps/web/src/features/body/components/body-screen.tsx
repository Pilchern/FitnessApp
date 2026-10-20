import { createBodyMetricAction, updateBodyMetricAction } from "../actions";
import { getBodyPageData } from "../server";
import { BodyMetricList } from "./body-metric-list";
import { BodyQuickForm } from "./body-quick-form";
import { BodySummaryCards } from "./body-summary-cards";
import { BodyTrendSection } from "./body-trend-section";
import { PageHeader } from "@/components/shared/page-header";

type BodyScreenProps = {
  editMetricId?: string;
  deleted?: boolean;
  error?: string;
};

export async function BodyScreen({
  editMetricId,
  deleted,
  error,
}: BodyScreenProps) {
  const data = await getBodyPageData(editMetricId);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Body"
        subtitle="Weight and body fat sync from Withings. Log tape measurements and DEXA results here."
      />

      <BodySummaryCards
        summary={data.summary}
        weeklyWeight={data.weeklyWeight}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      ) : null}

      <BodyQuickForm
        mode={data.editingMetric ? "edit" : "create"}
        metric={data.editingMetric}
        action={
          data.editingMetric ? updateBodyMetricAction : createBodyMetricAction
        }
        formError={data.formError}
      />

      <BodyTrendSection
        weightTrend={data.weightTrend}
        waistTrend={data.waistTrend}
        bodyFatTrend={data.bodyFatTrend}
      />

      <BodyMetricList metrics={data.metrics} deleted={deleted} />
    </div>
  );
}
