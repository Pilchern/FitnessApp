import Link from "next/link";
import type { NutritionTargets } from "../types";

type MacroProgressCardProps = {
  proteinHitDays: number;
  fiberTakenDays: number;
  totalDays: number;
  targets: NutritionTargets;
};

type ProgressBarProps = {
  label: string;
  hitDays: number;
  totalDays: number;
  targetLabel: string | null;
  unit: string;
};

function ProgressBar({ label, hitDays, totalDays, targetLabel, unit }: ProgressBarProps) {
  const pct = totalDays === 0 ? 0 : Math.round((hitDays / totalDays) * 100);
  const isOver = pct > 100;
  const cappedPct = Math.min(pct, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink/60">
          {totalDays === 0 ? (
            <span className="text-ink/40">No data yet</span>
          ) : targetLabel !== null ? (
            <>
              <span className={isOver ? "text-ember font-semibold" : "text-ink"}>
                {hitDays}d
              </span>
              <span className="text-ink/40"> / {totalDays}d {unit}</span>
              <span className="ml-2 text-xs text-ink/50">{pct}%</span>
            </>
          ) : (
            <span className="text-ink/70">{hitDays} / {totalDays} days</span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-pine/15">
        {totalDays > 0 && (
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-ember" : "bg-pine"}`}
            style={{ width: `${cappedPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function MacroProgressCard({
  proteinHitDays,
  fiberTakenDays,
  totalDays,
  targets,
}: MacroProgressCardProps) {
  const noTargets =
    targets.dailyProteinGramsTarget === null &&
    targets.dailyCaloriesTarget === null &&
    targets.dailyFiberGramsTarget === null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Today&apos;s progress
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Macro adherence</h2>
        </div>
        {noTargets && (
          <Link
            href="/settings"
            className="shrink-0 text-xs text-ink/50 underline decoration-ink/20 underline-offset-2 hover:text-pine"
          >
            Set targets in Settings
          </Link>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <ProgressBar
          label="Protein"
          hitDays={proteinHitDays}
          totalDays={totalDays}
          targetLabel={
            targets.dailyProteinGramsTarget !== null
              ? `${targets.dailyProteinGramsTarget}g target`
              : null
          }
          unit="protein hit"
        />
        <ProgressBar
          label="Fiber"
          hitDays={fiberTakenDays}
          totalDays={totalDays}
          targetLabel={
            targets.dailyFiberGramsTarget !== null
              ? `${targets.dailyFiberGramsTarget}g target`
              : null
          }
          unit="fiber taken"
        />
      </div>

      {noTargets && (
        <p className="mt-4 text-xs text-ink/50">
          Showing adherence rate only. Set protein and fiber targets in{" "}
          <Link href="/settings" className="underline decoration-ink/20 underline-offset-2 hover:text-pine">
            Settings
          </Link>{" "}
          to enable goal tracking.
        </p>
      )}
    </section>
  );
}
