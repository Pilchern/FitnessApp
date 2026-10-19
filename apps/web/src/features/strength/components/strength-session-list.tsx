"use client";

import { useState } from "react";
import Link from "next/link";
import type { StrengthSession } from "@fitness-app/domain";
import { deleteStrengthSessionAction } from "../actions";
import { formatStrengthDate } from "../helpers";

const PAGE_SIZE = 10;

type StrengthSessionListProps = {
  sessions: StrengthSession[];
};

export function StrengthSessionList({ sessions }: StrengthSessionListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, PAGE_SIZE);

  if (sessions.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 py-12 shadow-panel">
        <div className="max-w-sm mx-auto text-center">
          <div className="text-4xl">🏋️</div>
          <h2 className="mt-4 font-display text-xl text-ink">
            No strength sessions yet
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Start a session to begin tracking your lifts and building your
            history.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg text-ink">History</h2>
        <div className="text-sm text-ink/55">{sessions.length} total</div>
      </div>

      {/* One row per session; tap for exercises, View, Edit and Delete. */}
      <ul className="mt-3 divide-y divide-ink/10">
        {visible.map((session) => {
          const uniqueExercises = [
            ...new Set(session.sets.map((set) => set.exerciseName)),
          ];
          const summary = [
            `${session.sets.length} set${session.sets.length !== 1 ? "s" : ""}`,
            session.durationMinutes != null
              ? `${session.durationMinutes} min`
              : null,
          ].filter(Boolean);
          const details = [
            session.avgHeartRate != null
              ? `Avg HR ${session.avgHeartRate}`
              : null,
            session.activeEnergyKcal != null
              ? `${session.activeEnergyKcal} kcal`
              : null,
            session.readinessPre != null
              ? `Readiness ${session.readinessPre}/10`
              : null,
            session.completedAsPlanned ? null : "Adjusted",
          ].filter(Boolean);

          return (
            <li key={session.id}>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {formatStrengthDate(session.sessionDate)}
                    </span>
                    <span className="block truncate text-xs text-ink/55">
                      {session.sessionName ?? "Strength session"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm text-ink/65">
                    {summary.join(" · ")}
                  </span>
                </summary>
                <div className="space-y-3 pb-4 text-sm text-ink/70">
                  {uniqueExercises.length > 0 ? (
                    <p>{uniqueExercises.join(" · ")}</p>
                  ) : null}
                  {details.length > 0 ? <p>{details.join(" · ")}</p> : null}
                  {session.notes ? (
                    <p className="text-ink/80">{session.notes}</p>
                  ) : null}
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/strength/${session.id}`}
                      className="inline-flex min-h-10 items-center font-semibold text-pine hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/strength?edit=${session.id}`}
                      className="inline-flex min-h-10 items-center font-semibold text-pine hover:underline"
                    >
                      Edit
                    </Link>
                    <form
                      action={deleteStrengthSessionAction}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Delete ${session.sessionName ?? "this session"} (${formatStrengthDate(session.sessionDate)})?`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={session.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center font-semibold text-ember hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {sessions.length > PAGE_SIZE ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            {showAll ? "Show fewer" : `Show all ${sessions.length} sessions`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
