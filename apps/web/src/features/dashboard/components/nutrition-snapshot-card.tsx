import Link from "next/link";
import type { TodayNutrition, NutritionTargetsSnapshot } from "../types";

type NutritionSnapshotCardProps = {
  todayNutrition: TodayNutrition | null;
  nutritionTargets: NutritionTargetsSnapshot;
};

function AdherenceStat({
  label,
  hitDays,
  totalDays,
}: {
  label: string;
  hitDays: number;
  totalDays: number;
}) {
  const pct = totalDays === 0 ? 0 : Math.round((hitDays / totalDays) * 100);
  const cappedPct = Math.min(pct, 100);
  const isGood = pct >= 70;

  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-ink/60">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${isGood ? "text-pine" : "text-ink"}`}>
        {hitDays}
        <span className="text-xl font-normal opacity-60">d</span>
        <span className="ml-1 text-base font-normal opacity-50">/ {totalDays}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-pine/15">
        <div
          className={`h-full rounded-full ${isGood ? "bg-pine" : "bg-amber-400"}`}
          style={{ width: `${cappedPct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-ink/50">{pct}% rate</div>
    </div>
  );
}

export function NutritionSnapshotCard({
  todayNutrition,
  nutritionTargets,
}: NutritionSnapshotCardProps) {
  if (!todayNutrition) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/75 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Nutrition
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Nothing logged this week</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Log your daily nutrition checks to track protein and fiber consistency.
        </p>
        <Link
          href="/nutrition"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Log nutrition
        </Link>
      </section>
    );
  }

  const noTargets =
    nutritionTargets.calories === null &&
    nutritionTargets.proteinGrams === null &&
    nutritionTargets.fiberGrams === null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Nutrition
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Last 7 days</h2>
        </div>
        <Link
          href="/nutrition"
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          View nutrition
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <AdherenceStat
          label="Protein hit"
          hitDays={todayNutrition.proteinHitDays}
          totalDays={todayNutrition.totalDays}
        />
        <AdherenceStat
          label="Fiber taken"
          hitDays={todayNutrition.fiberTakenDays}
          totalDays={todayNutrition.totalDays}
        />
      </div>

      {noTargets && (
        <p className="mt-4 text-xs text-ink/50">
          <Link
            href="/settings"
            className="underline decoration-ink/20 underline-offset-2 hover:text-pine"
          >
            Set targets in Settings
          </Link>{" "}
          to enable goal tracking.
        </p>
      )}
    </section>
  );
}
