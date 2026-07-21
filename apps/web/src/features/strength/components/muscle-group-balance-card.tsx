import type { MuscleGroupVolumeSummary } from "@fitness-app/application";

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

function formatRatio(ratio: number | null): string {
  if (ratio == null) return "Not enough data yet";
  if (ratio > 1.3)
    return `Push volume is ${ratio}x pull — pulling may be lagging`;
  if (ratio < 0.77)
    return `Pull volume is ${(1 / ratio).toFixed(2)}x push — pressing may be lagging`;
  return `Push and pull volume are balanced (${ratio}x)`;
}

export function MuscleGroupBalanceCard({
  summary,
}: MuscleGroupBalanceCardProps) {
  const trainedGroups = summary.byMuscleGroup.filter(
    (g) => g.workingSetCount > 0,
  );
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
        Working sets by muscle group (warm-ups excluded), so you can spot
        what&apos;s neglected before it becomes a pattern.
      </p>

      {!hasAnyData ? (
        <p className="mt-5 text-sm leading-6 text-ink/75">
          No strength sets logged in the last 7 days yet.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.byMuscleGroup.map((group) => {
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
                      : `${group.totalVolume.toLocaleString()} lb volume`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-ink/10 bg-white/70 p-4 text-sm text-ink/75">
            {formatRatio(summary.pushPullVolumeRatio)}
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
