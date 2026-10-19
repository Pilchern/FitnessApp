import { getStrengthPageData } from "../server";
import { ClassifyExerciseCard } from "./classify-exercise-card";
import { MuscleGroupBalanceCard } from "./muscle-group-balance-card";
import { StrengthProgressionSummarySection } from "./strength-progression-summary";
import { StrengthSessionList } from "./strength-session-list";
import { StrengthPageClient } from "./strength-page-client";
import { PageHeader } from "@/components/shared/page-header";

type StrengthScreenProps = {
  editSessionId?: string;
  /** Set by delete/archive/schedule actions when they fail. */
  error?: string;
};

export async function StrengthScreen({
  editSessionId,
  error,
}: StrengthScreenProps) {
  const data = await getStrengthPageData(editSessionId);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Strength" />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {error}
        </div>
      ) : null}

      <StrengthPageClient
        mode={data.editingSession ? "edit" : "create"}
        session={data.editingSession}
        formError={data.formError}
        knownExercises={data.knownExercises}
        lastSession={data.lastSession}
        strengthTemplates={data.strengthTemplates}
        todaysScheduledTemplate={data.todaysScheduledTemplate}
        programPlan={data.programPlan}
        lastByExercise={data.lastByExercise}
        latestCreatedAt={data.latestCreatedAt}
      />

      <MuscleGroupBalanceCard summary={data.muscleGroupVolume} />

      <ClassifyExerciseCard
        unclassifiedExerciseNames={data.unclassifiedExerciseNames}
        overrides={data.exerciseOverrides}
      />

      <StrengthProgressionSummarySection
        summaries={data.progressionSummaries}
        collapsible
      />

      <StrengthSessionList sessions={data.sessions} />
    </div>
  );
}
