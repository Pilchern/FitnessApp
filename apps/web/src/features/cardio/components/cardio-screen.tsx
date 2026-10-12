import {
  createCardioSessionAction,
  updateCardioSessionAction,
} from "../actions";
import { getCardioPageData } from "../server";
import { CardioQuickForm } from "./cardio-quick-form";
import { CardioSessionList } from "./cardio-session-list";
import { CardioSummaryCards } from "./cardio-summary-cards";
import { PageHeader } from "@/components/shared/page-header";

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
      />

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
