import {
  createCardioSessionAction,
  updateCardioSessionAction,
} from "../actions";
import { getCardioPageData } from "../server";
import { CardioQuickForm } from "./cardio-quick-form";
import { CardioSessionList } from "./cardio-session-list";
import { CardioSummaryCards } from "./cardio-summary-cards";
import { PageHeader } from "@/components/shared/page-header";
import { TrendChart } from "@/components/shared/trend-chart";

type CardioScreenProps = {
  editSessionId?: string;
  deleted?: boolean;
  error?: string;
};

export async function CardioScreen({
  editSessionId,
  deleted,
  error,
}: CardioScreenProps) {
  const data = await getCardioPageData(editSessionId);
  const form = (
    <CardioQuickForm
      mode={data.editingSession ? "edit" : "create"}
      templates={data.templates}
      session={data.editingSession}
      action={
        data.editingSession
          ? updateCardioSessionAction
          : createCardioSessionAction
      }
      formError={data.formError}
    />
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Cardio"
        subtitle="Rides sync from Apple Health every hour. Edit one to add notes or RPE."
      />

      <CardioSummaryCards
        weeklyTotals={data.weeklyTotals}
        zone2TargetMinutes={data.zone2TargetMinutes}
        zone2Band={data.zone2Band}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart
          title="Zone 2 output"
          description={`Average watts on Zone 2 rides (HR ${data.zone2Band}). Rising at the same heart rate is the progress.`}
          points={data.zone2OutputTrend}
          formatValue={(w) => `${w} W`}
          emptyMessage="Add avg output to a Zone 2 ride to start the trend."
        />
        <TrendChart
          title="Interval output"
          description="Mean watts across the work intervals of each VO2 ride."
          points={data.intervalOutputTrend}
          formatValue={(w) => `${w} W`}
          emptyMessage="Log interval outputs on a VO2 ride to start the trend."
          strokeClassName="stroke-ember"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      ) : null}

      {data.editingSession || data.formError ? form : null}

      <CardioSessionList
        sessions={data.sessions}
        templates={data.templates}
        deleted={deleted}
      />

      {data.editingSession || data.formError ? null : form}
    </div>
  );
}
