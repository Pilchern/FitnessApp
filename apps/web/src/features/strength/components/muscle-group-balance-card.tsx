import type { MuscleGroupVolumeSummary } from "@fitness-app/application";
import { NICK_TRAINING_PLAN } from "@/lib/training-plan";

type MuscleGroupBalanceCardProps = {
  summary: MuscleGroupVolumeSummary;
};

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
};

/**
 * Push vs pull by working sets, not tonnage: pull-ups and band face pulls log
 * no weight, so a tonnage ratio would call pulling "lagging" every week.
 */
function formatSetBalance(summary: MuscleGroupVolumeSummary): string {
  const sets = (pattern: string) =>
    summary.byMovementPattern.find((p) => p.movementPattern === pattern)
      ?.workingSetCount ?? 0;
  const push = sets("push");
  const pull = sets("pull");
  if (push === 0 || pull === 0) return "Push vs pull: not enough data yet.";
  const counts = `Push ${push} sets, pull ${pull} sets`;
  const ratio = push / pull;
  if (ratio > 1.3) return `${counts}. Pulling may be lagging.`;
  if (ratio < 0.77) return `${counts}. Pressing may be lagging.`;
  return `${counts}. Balanced.`;
}

export function MuscleGroupBalanceCard({
  summary,
}: MuscleGroupBalanceCardProps) {
  // Legs are trained in the PT app during rehab; don't flag them here.
  const excluded = new Set<string>(NICK_TRAINING_PLAN.excludedMuscleGroups);
  const groups = summary.byMuscleGroup.filter(
    (g) => !excluded.has(g.muscleGroup),
  );
  const trainedGroups = groups.filter((g) => g.workingSetCount > 0);
  const hasAnyData = trainedGroups.length > 0;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Last 7 days
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">
        Muscle group balance
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink/75">
        Working sets by muscle group. Warm-ups excluded.
      </p>

      {!hasAnyData ? (
        <p className="mt-5 text-sm leading-6 text-ink/75">
          No strength sets logged in the last 7 days yet.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {groups.map((group) => {
              const isNeglected = group.workingSetCount === 0;
              return (
                <div
                  key={group.muscleGroup}
                  className={`rounded-[1.25rem] border p-3 ${
                    isNeglected
                      ? "border-ember/20 bg-ember/5"
                      : "border-ink/10 bg-sand/50"
                  }`}
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-ink/60">
                    {MUSCLE_GROUP_LABELS[group.muscleGroup] ??
                      group.muscleGroup}
                  </div>
                  <div
                    className={`mt-1 text-lg font-semibold ${isNeglected ? "text-ember" : "text-ink"}`}
                  >
                    {group.workingSetCount}{" "}
                    {group.workingSetCount === 1 ? "set" : "sets"}
                  </div>
                  <div className="text-xs text-ink/50">
                    {isNeglected
                      ? "Not trained this week"
                      : group.totalVolume > 0
                        ? `${group.totalVolume.toLocaleString()} lb`
                        : "Bodyweight"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-ink/10 bg-white/70 p-4 text-sm text-ink/75">
            {formatSetBalance(summary)}
          </div>

          {summary.unclassifiedWorkingSetCount > 0 ? (
            <p className="mt-3 text-xs text-ink/45">
              {summary.unclassifiedWorkingSetCount} logged{" "}
              {summary.unclassifiedWorkingSetCount === 1 ? "set" : "sets"} used
              an exercise name we don&apos;t recognize yet, so it isn&apos;t
              counted above.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
