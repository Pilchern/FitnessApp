import {
  createNutritionLogAction,
  updateNutritionLogAction,
} from "../actions";
import { getNutritionPageData } from "../server";
import { NutritionLogList } from "./nutrition-log-list";
import { NutritionQuickForm } from "./nutrition-quick-form";
import { NutritionSummaryCards } from "./nutrition-summary-cards";

type NutritionScreenProps = {
  editLogId?: string;
};

export async function NutritionScreen({ editLogId }: NutritionScreenProps) {
  const data = await getNutritionPageData(editLogId);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Nutrition module
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">Nutrition</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Track daily nutrition checks: protein, meal plan adherence,
          post-dinner snacking, junk leakage, and fiber. Keep it fast enough to
          stay consistent.
        </p>
      </section>

      <NutritionSummaryCards summary={data.summary} targets={data.targets} />

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
