import { getInsightsData } from "../server";
import { InsightsList } from "./insights-list";
import { PageHeader } from "@/components/shared/page-header";

export async function InsightsScreen() {
  const { insights } = await getInsightsData();

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Insights"
        subtitle="Patterns from what you have logged. Items marked AI come from a language model: general information, not medical advice."
      />

      <InsightsList initialInsights={insights} />
    </div>
  );
}
