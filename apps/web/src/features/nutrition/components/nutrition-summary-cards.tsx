import type { NutritionAdherenceSummary } from "@fitness-app/application";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import type { NutritionTargets } from "../types";

type NutritionSummaryCardsProps = {
  summary: NutritionAdherenceSummary;
  targets: NutritionTargets;
};

type AdherenceGoalCardProps = {
  label: string;
  /** Days the check was hit in the window. */
  hitDays: number;
  /** Total days in the window. */
  totalDays: number;
  /**
   * The user's daily target value (in grams, kcal, etc.) used as a label.
   * When null, no progress bar is shown and a "Set a goal" prompt is shown.
   */
  targetValue: number | null;
  /** Unit label displayed after the target value, e.g. "g" or "kcal". */
  targetUnit: string;
};

function AdherenceGoalCard({
  label,
  hitDays,
  totalDays,
  targetValue,
  targetUnit,
}: AdherenceGoalCardProps) {
  const pct = totalDays === 0 ? 0 : Math.round((hitDays / totalDays) * 100);
  const cappedPct = Math.min(pct, 100);
  const isOnTrack = pct >= 80;

  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4 text-ink">
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</div>

      <div className="mt-2 text-3xl font-semibold">
        {hitDays}
        <span className="text-xl font-normal opacity-60">d</span>
        <span className="ml-1 text-base font-normal opacity-50">
          / {totalDays} days
        </span>
      </div>

      {targetValue !== null ? (
        <>
          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full transition-all ${isOnTrack ? "bg-pine" : "bg-amber-400"}`}
              style={{ width: `${cappedPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="opacity-70">{pct}% hit rate</span>
            <span className="text-xs opacity-50">
              Target: {targetValue}
              {targetUnit}/day
            </span>
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm opacity-60">
          {pct}% hit rate
          <span className="mx-1.5 opacity-50">·</span>
          <a
            href="/settings"
            className="text-xs text-ink/50 underline decoration-ink/20 underline-offset-2 hover:text-pine"
          >
            Set a goal
          </a>
        </div>
      )}
    </div>
  );
}

export function NutritionSummaryCards({
  summary,
  targets,
}: NutritionSummaryCardsProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Last 7 logs
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            Nutrition snapshot
          </h2>
        </div>
        <div className="max-w-xs text-right text-sm leading-6 text-ink/70">
          Adherence averages across all boolean checks that have data.
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="7-day adherence"
          value={`${summary.adherencePct}%`}
          hint={`${summary.totalDays} days logged`}
          tone={
            summary.adherencePct >= 80
              ? "accent"
              : summary.adherencePct >= 50
                ? "default"
                : "alert"
          }
        />

        <AdherenceGoalCard
          label="Protein hit"
          hitDays={summary.proteinHitDays}
          totalDays={summary.totalDays}
          targetValue={targets.dailyProteinGramsTarget}
          targetUnit="g"
        />

        <AdherenceGoalCard
          label="Fiber taken"
          hitDays={summary.fiberTakenDays}
          totalDays={summary.totalDays}
          targetValue={targets.dailyFiberGramsTarget}
          targetUnit="g"
        />

        <SummaryStatCard
          label="Total alcohol"
          value={`${summary.totalAlcohol}`}
          hint="drinks this period"
          tone={
            summary.totalAlcohol === 0
              ? "accent"
              : summary.totalAlcohol > 7
                ? "alert"
                : "default"
          }
        />
      </div>
    </section>
  );
}
