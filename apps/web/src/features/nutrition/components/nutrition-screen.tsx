import { createNutritionLogAction, updateNutritionLogAction } from "../actions";
import { getNutritionPageData } from "../server";
import { NutritionLogList } from "./nutrition-log-list";
import { NutritionQuickForm } from "./nutrition-quick-form";
import { NutritionSummaryCards } from "./nutrition-summary-cards";
import { PageHeader } from "@/components/shared/page-header";

type NutritionScreenProps = {
  editLogId?: string;
  error?: string;
};

export async function NutritionScreen({
  editLogId,
  error,
}: NutritionScreenProps) {
  const data = await getNutritionPageData(editLogId);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Nutrition"
        subtitle="Daily checks: protein, plan adherence, fiber. No calorie counting."
      />

      <NutritionSummaryCards summary={data.summary} targets={data.targets} />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      ) : null}

      <NutritionQuickForm
        mode={data.editingLog ? "edit" : "create"}
        log={data.editingLog}
        action={
          data.editingLog ? updateNutritionLogAction : createNutritionLogAction
        }
        formError={data.formError}
      />

      <NutritionLogList logs={data.logs} />
    </div>
  );
}
