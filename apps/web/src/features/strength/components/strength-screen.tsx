import { getStrengthPageData } from "../server";
import { ClassifyExerciseCard } from "./classify-exercise-card";
import { MuscleGroupBalanceCard } from "./muscle-group-balance-card";
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
      <h1 className="font-display text-2xl text-ink md:text-4xl">Strength</h1>

      <StrengthPageClient
        mode={data.editingSession ? "edit" : "create"}
        session={data.editingSession}
        formError={data.formError}
        knownExercises={data.knownExercises}
        lastSession={data.lastSession}
        strengthTemplates={data.strengthTemplates}
        todaysScheduledTemplate={data.todaysScheduledTemplate}
        lastByExercise={data.lastByExercise}
      />

      <MuscleGroupBalanceCard summary={data.muscleGroupVolume} />

      <ClassifyExerciseCard
        unclassifiedExerciseNames={data.unclassifiedExerciseNames}
        overrides={data.exerciseOverrides}
      />

      <StrengthProgressionSummarySection
        summaries={data.progressionSummaries}
      />

      <StrengthSessionList sessions={data.sessions} />
    </div>
  );
}
