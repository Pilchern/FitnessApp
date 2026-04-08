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
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 p-8 text-center shadow-panel">
        <h2 className="font-display text-3xl text-ink">No sessions logged yet</h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Log your first session above. Add a few sets and you&apos;re done.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Strength history
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Sessions</h2>
        </div>
        <div className="text-sm text-ink/65">{sessions.length} total</div>
      </div>

      <div className="mt-5 space-y-4">
        {visible.map((session) => {
          const uniqueExercises = [...new Set(session.sets.map((set) => set.exerciseName))];
          const exerciseCount = uniqueExercises.length;
          const exercisePreview =
            uniqueExercises.length <= 4
              ? uniqueExercises.join(" · ")
              : `${uniqueExercises.slice(0, 3).join(" · ")} +${uniqueExercises.length - 3} more`;

          return (
            <article
              key={session.id}
              className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-ink">
                      {session.sessionName ?? "Strength session"}
                    </h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        session.completedAsPlanned
                          ? "border-pine/20 bg-pine/10 text-pine"
                          : "border-amber-300/40 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {session.completedAsPlanned ? "On plan" : "Adjusted"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/75">
                    <span>{formatStrengthDate(session.sessionDate)}</span>
                    <span>{exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}</span>
                    <span>{session.sets.length} set{session.sets.length !== 1 ? "s" : ""}</span>
                    {session.durationMinutes != null ? (
                      <span>{session.durationMinutes} min</span>
                    ) : null}
                    {session.readinessPre != null ? (
                      <span>Readiness {session.readinessPre}/10</span>
                    ) : null}
                  </div>

                  {exerciseCount > 0 ? (
                    <p className="text-xs text-ink/55">{exercisePreview}</p>
                  ) : null}

                  {session.notes ? (
                    <p className="text-sm leading-6 text-ink/75">{session.notes}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/strength/${session.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    View
                  </Link>
                  <Link
                    href={`/strength?edit=${session.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Edit
                  </Link>
                  <form action={deleteStrengthSessionAction}>
                    <input type="hidden" name="id" value={session.id} />
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
          );
        })}
      </div>

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
