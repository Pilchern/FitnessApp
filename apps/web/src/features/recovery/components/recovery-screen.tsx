import {
  createRecoveryCheckinAction,
  logSupplementsAction,
  updateRecoveryCheckinAction,
} from "../actions";
import { PageHeader } from "@/components/shared/page-header";
import { getRecoveryPageData } from "../server";
import { RecoveryCheckinList } from "./recovery-checkin-list";
import { RecoveryQuickForm } from "./recovery-quick-form";
import { RecoverySummaryCards } from "./recovery-summary-cards";
import { RecoveryTrendSection } from "./recovery-trend-section";
import { SupplementChecklist } from "./supplement-checklist";

type RecoveryScreenProps = {
  editCheckinId?: string;
  error?: string;
};

export async function RecoveryScreen({
  editCheckinId,
  error,
}: RecoveryScreenProps) {
  const data = await getRecoveryPageData(editCheckinId);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Recovery" />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      ) : null}

      {/* Today's row, when the sleep sync already made one, opens prefilled
          so a check-in adds to it instead of starting a second row. */}
      <RecoveryQuickForm
        mode={data.editingCheckin ? "edit" : "create"}
        checkin={data.editingCheckin ?? data.todaysCheckin}
        action={
          (data.editingCheckin ?? data.todaysCheckin)
            ? updateRecoveryCheckinAction
            : createRecoveryCheckinAction
        }
        formError={data.formError}
      />

      <RecoverySummaryCards summary={data.summary} />

      <SupplementChecklist
        supplements={data.activeSupplements}
        takenSupplementIds={data.supplementsTakenToday}
        logDate={data.todayIsoDate}
        action={logSupplementsAction}
      />

      <RecoveryTrendSection
        sleepTrend={data.sleepTrend}
        restingHeartRateTrend={data.restingHeartRateTrend}
        hrvTrend={data.hrvTrend}
      />

      <RecoveryCheckinList checkins={data.checkins} />
    </div>
  );
}
