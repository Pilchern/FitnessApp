import type { TargetProgress } from "@fitness-app/application";
import { formatTarget } from "../helpers";

/** One row per target: current value, each horizon, and a bar to the next one. */
export function TargetProgressList({ targets }: { targets: TargetProgress[] }) {
  return (
    <ul className="mt-3 divide-y divide-ink/5">
      {targets.map((t) => {
        const dp = t.unit === "lb" ? 2 : t.key === "almi" ? 2 : 1;
        return (
          <li key={t.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{t.label}</span>
              <span className="text-sm tabular-nums text-ink">
                {t.current == null
                  ? "no data"
                  : formatTarget(t.current, dp, t.unit)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink/55">
              {t.targets
                .map(
                  (h) =>
                    `${h.label} ${t.direction === "down" ? "≤" : "≥"}${formatTarget(h.value, dp, t.unit)}${h.met ? " ✓" : ""}`,
                )
                .join(" · ")}
              {` · ${t.source}`}
            </p>
            {t.progressPct != null && t.next ? (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"
                role="img"
                aria-label={`${t.progressPct}% of the way to ${t.next.label}`}
              >
                <div
                  className="h-full rounded-full bg-pine"
                  style={{ width: `${t.progressPct}%` }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
