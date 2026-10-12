"use client";

import { useState } from "react";
import Link from "next/link";
import type { RecoveryCheckin } from "@fitness-app/domain";
import { deleteRecoveryCheckinAction } from "../actions";
import {
  formatHours,
  formatRecoveryDate,
  formatScore,
  formatSleepEfficiency,
  formatSleepStageMinutes,
} from "../helpers";

const PAGE_SIZE = 10;

type RecoveryCheckinListProps = {
  checkins: RecoveryCheckin[];
};

export function RecoveryCheckinList({ checkins }: RecoveryCheckinListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? checkins : checkins.slice(0, PAGE_SIZE);
  if (checkins.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 py-12 shadow-panel">
        <div className="max-w-sm mx-auto text-center">
          <div className="text-4xl">🌙</div>
          <h2 className="mt-4 font-display text-xl text-ink">
            No check-ins yet
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Log today&apos;s readiness, sleep, and HRV to start building your
            recovery baseline.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg text-ink">History</h2>
        <div className="text-sm text-ink/55">{checkins.length} nights</div>
      </div>

      {/* One row per night; tap for stages, notes, edit and delete. */}
      <ul className="mt-3 divide-y divide-ink/10">
        {visible.map((checkin) => {
          const summary = [
            checkin.sleepDurationMinutes != null
              ? formatHours(
                  Math.round((checkin.sleepDurationMinutes / 60) * 10) / 10,
                )
              : null,
            checkin.restingHeartRate != null
              ? `RHR ${checkin.restingHeartRate}`
              : null,
            checkin.hrv != null ? `HRV ${Math.round(checkin.hrv)}` : null,
            checkin.readinessLevel != null
              ? `Ready ${checkin.readinessLevel}/10`
              : null,
            checkin.sorenessLevel != null
              ? `Sore ${checkin.sorenessLevel}/10`
              : null,
          ].filter(Boolean);
          const details = [
            checkin.bedtimeLocal
              ? `Bed ${checkin.bedtimeLocal.slice(0, 5)}`
              : null,
            checkin.wakeTimeLocal
              ? `Up ${checkin.wakeTimeLocal.slice(0, 5)}`
              : null,
            checkin.deepSleepMinutes != null
              ? `Deep ${formatSleepStageMinutes(checkin.deepSleepMinutes)}`
              : null,
            checkin.remSleepMinutes != null
              ? `REM ${formatSleepStageMinutes(checkin.remSleepMinutes)}`
              : null,
            checkin.coreSleepMinutes != null
              ? `Core ${formatSleepStageMinutes(checkin.coreSleepMinutes)}`
              : null,
            checkin.awakeMinutes != null
              ? `Awake ${formatSleepStageMinutes(checkin.awakeMinutes)}`
              : null,
            checkin.sleepEfficiencyPct != null
              ? `Efficiency ${formatSleepEfficiency(checkin.sleepEfficiencyPct)}`
              : null,
            checkin.sleepQuality != null
              ? `Quality ${formatScore(checkin.sleepQuality, "/5")}`
              : null,
            checkin.energyLevel != null
              ? `Energy ${formatScore(checkin.energyLevel)}`
              : null,
            checkin.stressLevel != null
              ? `Stress ${formatScore(checkin.stressLevel)}`
              : null,
            checkin.alcoholCount > 0 ? `Drinks ${checkin.alcoholCount}` : null,
            checkin.coldPlungeCompleted ? "Cold plunge" : null,
          ].filter(Boolean);

          return (
            <li key={checkin.id}>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
                  <span className="text-sm font-medium text-ink">
                    {formatRecoveryDate(checkin.checkinDate)}
                  </span>
                  <span className="text-right text-sm text-ink/65">
                    {summary.length > 0 ? summary.join(" · ") : "No data"}
                  </span>
                </summary>
                <div className="space-y-3 pb-4 text-sm text-ink/70">
                  {details.length > 0 ? <p>{details.join(" · ")}</p> : null}
                  {checkin.notes ? (
                    <p className="text-ink/80">{checkin.notes}</p>
                  ) : null}
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/recovery?edit=${checkin.id}`}
                      className="font-semibold text-pine hover:underline"
                    >
                      Edit
                    </Link>
                    <form
                      action={deleteRecoveryCheckinAction}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            "Delete this night? Synced sleep and heart rate for it go too.",
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={checkin.id} />
                      <button
                        type="submit"
                        className="font-semibold text-ember hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                    {checkin.source.sourceType !== "manual" ? (
                      <span className="ml-auto text-xs text-ink/45">
                        {checkin.source.sourceProvider === "apple_health"
                          ? "Apple Health"
                          : checkin.source.sourceProvider}
                      </span>
                    ) : null}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {checkins.length > PAGE_SIZE ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            {showAll ? "Show fewer" : `Show all ${checkins.length} check-ins`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
