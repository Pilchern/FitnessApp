import {
  createCardioSessionAction,
  updateCardioSessionAction,
} from "../actions";
import { getCardioPageData } from "../server";
import { CardioQuickForm } from "./cardio-quick-form";
import { CardioSessionList } from "./cardio-session-list";
import { CardioSummaryCards } from "./cardio-summary-cards";

type CardioScreenProps = {
  editSessionId?: string;
  deleted?: boolean;
};

export async function CardioScreen({ editSessionId, deleted }: CardioScreenProps) {
  const data = await getCardioPageData(editSessionId);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          This week
        </p>
        <h1 className="mt-3 font-display text-2xl md:text-4xl text-ink">Cardio</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Log your workouts and cardio sessions. Pick a template to pre-fill the
          basics, then add more detail if you want it.
        </p>
      </section>

      <CardioSummaryCards
        weeklyTotals={data.weeklyTotals}
        adherence={data.adherence}
      />

      <CardioQuickForm
        mode={data.editingSession ? "edit" : "create"}
        templates={data.templates}
        session={data.editingSession}
        action={data.editingSession ? updateCardioSessionAction : createCardioSessionAction}
        formError={data.formError}
      />

      <CardioSessionList sessions={data.sessions} templates={data.templates} deleted={deleted} />
    </div>
  );
}
