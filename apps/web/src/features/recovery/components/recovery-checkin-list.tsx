"use client";

import { useState } from "react";
import Link from "next/link";
import type { RecoveryCheckin } from "@fitness-app/domain";
import { deleteRecoveryCheckinAction } from "../actions";
import {
  formatHours,
  formatRecoveryDate,
  formatRestingHeartRate,
  formatScore,
  formatSleepEfficiency,
  formatSleepStageMinutes,
} from "../helpers";

const PAGE_SIZE = 14;

type RecoveryCheckinListProps = {
  checkins: RecoveryCheckin[];
};

export function RecoveryCheckinList({
  checkins,
}: RecoveryCheckinListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? checkins : checkins.slice(0, PAGE_SIZE);
  if (checkins.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 py-12 shadow-panel">
        <div className="max-w-sm mx-auto text-center">
          <div className="text-4xl">🌙</div>
          <h2 className="mt-4 font-display text-xl text-ink">No check-ins yet</h2>
          <p className="mt-2 text-sm text-ink/60">
            Log today&apos;s readiness, sleep, and HRV to start building your recovery baseline.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            History
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            Recent check-ins
          </h2>
        </div>
        <div className="text-sm text-ink/65">{checkins.length} total</div>
      </div>

      <div className="mt-5 space-y-4">
        {visible.map((checkin) => (
          <article
            key={checkin.id}
            className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-ink">
                  {formatRecoveryDate(checkin.checkinDate)}
                </h3>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/75">
                  <span>{`Sleep ${formatHours(
                    checkin.sleepDurationMinutes != null
                      ? Math.round((checkin.sleepDurationMinutes / 60) * 10) / 10
                      : null,
                  )}`}</span>
                  <span>{`Quality ${formatScore(checkin.sleepQuality, "/5")}`}</span>
                  <span className="inline-flex items-center gap-1.5">
                    {`Readiness ${formatScore(checkin.readinessLevel)}`}
                    {checkin.readinessLevel != null && checkin.readinessLevel >= 8 ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-pine" />
                    ) : null}
                  </span>
                  <span>{`Stress ${formatScore(checkin.stressLevel)}`}</span>
                  <span>{`Soreness ${formatScore(checkin.sorenessLevel)}`}</span>
                  <span>{`Alcohol ${checkin.alcoholCount}`}</span>
                  <span>{`RHR ${formatRestingHeartRate(checkin.restingHeartRate)}`}</span>
                  {checkin.hrv != null ? <span>{`HRV ${checkin.hrv}`}</span> : null}
                </div>

                {(checkin.deepSleepMinutes != null ||
                  checkin.remSleepMinutes != null ||
                  checkin.coreSleepMinutes != null ||
                  checkin.awakeMinutes != null ||
                  checkin.sleepEfficiencyPct != null) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-ink/60">
                      {[
                        checkin.deepSleepMinutes != null &&
                          `Deep ${formatSleepStageMinutes(checkin.deepSleepMinutes)}`,
                        checkin.remSleepMinutes != null &&
                          `REM ${formatSleepStageMinutes(checkin.remSleepMinutes)}`,
                        checkin.coreSleepMinutes != null &&
                          `Core ${formatSleepStageMinutes(checkin.coreSleepMinutes)}`,
                        checkin.awakeMinutes != null &&
                          `Awake ${formatSleepStageMinutes(checkin.awakeMinutes)}`,
                        checkin.sleepEfficiencyPct != null &&
                          `Efficiency ${formatSleepEfficiency(checkin.sleepEfficiencyPct)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {(checkin.source.sourceType === "imported" ||
                      checkin.source.sourceType === "mixed") &&
                    checkin.source.sourceProvider != null &&
                    (checkin.sleepDurationMinutes != null ||
                      checkin.deepSleepMinutes != null) ? (
                      <span className="rounded-full border border-ink/10 bg-white px-2.5 py-0.5 text-xs text-ink/50">
                        {checkin.source.sourceProvider === "apple_health"
                          ? "Apple Health"
                          : checkin.source.sourceProvider === "withings"
                            ? "Withings"
                            : checkin.source.sourceProvider.charAt(0).toUpperCase() +
                              checkin.source.sourceProvider.slice(1)}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {checkin.notes ? (
                  <p className="text-sm leading-6 text-ink/75">{checkin.notes}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/recovery?edit=${checkin.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                >
                  Edit
                </Link>
                <form action={deleteRecoveryCheckinAction}>
                  <input type="hidden" name="id" value={checkin.id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>

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
