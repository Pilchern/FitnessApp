import {
  createRecoveryCheckinAction,
  updateRecoveryCheckinAction,
} from "../actions";
import { getRecoveryPageData } from "../server";
import { RecoveryCheckinList } from "./recovery-checkin-list";
import { RecoveryQuickForm } from "./recovery-quick-form";
import { RecoverySummaryCards } from "./recovery-summary-cards";
import { RecoveryTrendSection } from "./recovery-trend-section";

type RecoveryScreenProps = {
  editCheckinId?: string;
};

export async function RecoveryScreen({ editCheckinId }: RecoveryScreenProps) {
  const data = await getRecoveryPageData(editCheckinId);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Today
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">Recovery</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          A quick daily check-in — sleep, readiness, stress, and soreness.
          Takes less than a minute and helps you understand why training
          feels the way it does.
        </p>
      </section>

      <RecoverySummaryCards summary={data.summary} />

      <RecoveryQuickForm
        mode={data.editingCheckin ? "edit" : "create"}
        checkin={data.editingCheckin}
        action={
          data.editingCheckin
            ? updateRecoveryCheckinAction
            : createRecoveryCheckinAction
        }
        formError={data.formError}
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
