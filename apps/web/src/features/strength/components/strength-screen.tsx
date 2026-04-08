import { getStrengthPageData } from "../server";
import { StrengthProgressionSummarySection } from "./strength-progression-summary";
import { StrengthSessionList } from "./strength-session-list";
import { StrengthPageClient } from "./strength-page-client";

type StrengthScreenProps = {
  editSessionId?: string;
};

export async function StrengthScreen({ editSessionId }: StrengthScreenProps) {
  const data = await getStrengthPageData(editSessionId);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          This week
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">Strength</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Log your lifts, track your sets, and see how your key movements
          are trending over time.
        </p>
      </section>

      <StrengthPageClient
        mode={data.editingSession ? "edit" : "create"}
        session={data.editingSession}
        formError={data.formError}
        knownExercises={data.knownExercises}
        lastSession={data.lastSession}
        strengthTemplates={data.strengthTemplates}
      />

      <StrengthProgressionSummarySection summaries={data.progressionSummaries} />

      <StrengthSessionList sessions={data.sessions} />
    </div>
  );
}
