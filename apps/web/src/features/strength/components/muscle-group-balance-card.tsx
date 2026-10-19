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

/**
 * Working sets per muscle group over the last 7 days, folded to one row: the
 * summary names anything untrained, the detail lists every group.
 */
export function MuscleGroupBalanceCard({
  summary,
}: MuscleGroupBalanceCardProps) {
  const excluded = new Set<string>(NICK_TRAINING_PLAN.excludedMuscleGroups);
  const groups = summary.byMuscleGroup.filter(
    (g) => !excluded.has(g.muscleGroup),
  );
  const hasAnyData = groups.some((g) => g.workingSetCount > 0);
  const neglected = groups.filter((g) => g.workingSetCount === 0);

  return (
    <details className="group rounded-[1.75rem] border border-ink/10 bg-white/80 shadow-panel">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          Muscle balance
          <span className="ml-2 font-normal text-ink/50">7 days</span>
          {hasAnyData && neglected.length > 0 ? (
            <span className="block text-xs font-normal text-ember">
              Not trained:{" "}
              {neglected
                .map((g) => MUSCLE_GROUP_LABELS[g.muscleGroup] ?? g.muscleGroup)
                .join(", ")}
            </span>
          ) : null}
        </span>
        <span className="text-ink/50 group-open:hidden">+</span>
        <span className="hidden text-ink/50 group-open:inline">−</span>
      </summary>
      <div className="border-t border-ink/10 px-6 py-4">
        {!hasAnyData ? (
          <p className="text-sm text-ink/70">
            No strength sets logged in the last 7 days yet.
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {groups.map((group) => (
                <li
                  key={group.muscleGroup}
                  className="flex justify-between gap-2"
                >
                  <span className="text-ink/70">
                    {MUSCLE_GROUP_LABELS[group.muscleGroup] ??
                      group.muscleGroup}
                  </span>
                  <span
                    className={`tabular-nums ${group.workingSetCount === 0 ? "font-semibold text-ember" : "font-semibold text-ink"}`}
                  >
                    {group.workingSetCount}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink/75">
              {formatSetBalance(summary)}
            </p>
            {summary.unclassifiedWorkingSetCount > 0 ? (
              <p className="mt-2 text-xs text-ink/45">
                Working sets, warm-ups excluded.{" "}
                {summary.unclassifiedWorkingSetCount} set
                {summary.unclassifiedWorkingSetCount === 1 ? "" : "s"} (drills
                and plyos) not counted.
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink/45">
                Working sets, warm-ups excluded.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
