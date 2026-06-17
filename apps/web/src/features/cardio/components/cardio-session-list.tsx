"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CardioSession } from "@fitness-app/domain";
import { deleteCardioSessionAction } from "../actions";
import {
  formatCardioDate,
  formatCompletionLabel,
  formatSessionKind,
  formatSportType,
} from "../helpers";
import type { CardioTemplatePreset } from "../types";
import { useToast } from "@/components/shared/toast-provider";

const PAGE_SIZE = 14;

type CardioSessionListProps = {
  sessions: CardioSession[];
  templates: CardioTemplatePreset[];
  deleted?: boolean;
};

function sessionStatusClassName(status: CardioSession["plannedVsCompleted"]) {
  switch (status) {
    case "completed":
      return "border-pine/25 bg-pine/10 text-pine";
    case "partial":
      return "border-amber-300/40 bg-amber-50 text-amber-700";
    case "skipped":
      return "border-ember/20 bg-ember/10 text-ember";
    default:
      return "border-ink/10 bg-white text-ink/70";
  }
}

function findTemplateName(
  session: CardioSession,
  templates: CardioTemplatePreset[],
) {
  return (
    templates.find((template) => template.id === session.trainingTemplateId)?.name ?? null
  );
}

export function CardioSessionList({
  sessions,
  templates,
  deleted,
}: CardioSessionListProps) {
  const [showAll, setShowAll] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (deleted) {
      showToast("Entry deleted");
      const url = new URL(window.location.href);
      url.searchParams.delete("deleted");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
  }, [deleted, showToast, router]);
  const visible = showAll ? sessions : sessions.slice(0, PAGE_SIZE);

  if (sessions.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 py-12 shadow-panel">
        <div className="max-w-sm mx-auto text-center">
          <div className="text-4xl">🚴</div>
          <h2 className="mt-4 font-display text-xl text-ink">No cardio logged yet</h2>
          <p className="mt-2 text-sm text-ink/60">
            Log your first ride, run, or workout using the form above.
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
          <h2 className="mt-3 font-display text-2xl text-ink">Recent workouts</h2>
        </div>
        <div className="text-sm text-ink/65">{sessions.length} total</div>
      </div>

      <div className="mt-5 space-y-4">
        {visible.map((session) => {
          const templateName = findTemplateName(session, templates);

          return (
            <article
              key={session.id}
              className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-ink">
                      {templateName ?? formatSessionKind(session.sessionKind)}
                    </h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${sessionStatusClassName(session.plannedVsCompleted)}`}
                    >
                      {formatCompletionLabel(session.plannedVsCompleted)}
                    </span>
                    {session.sportType ? (
                      <span className="rounded-full border border-ink/15 bg-sand px-2 py-0.5 text-xs font-medium text-ink/70">
                        {formatSportType(session.sportType)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/75">
                    <span>{formatCardioDate(session.sessionDate)}</span>
                    {session.durationMinutes != null ? (
                      <span>{session.durationMinutes} min</span>
                    ) : null}
                    {session.avgHeartRate != null ? (
                      <span>Avg HR {session.avgHeartRate}</span>
                    ) : null}
                    {session.avgOutput != null ? (
                      <span>Output {session.avgOutput}</span>
                    ) : null}
                    {session.rpe != null ? (
                      <span>RPE {session.rpe}</span>
                    ) : null}
                    {session.distanceMeters != null ? (
                      <span>{(session.distanceMeters / 1000).toFixed(1)} km</span>
                    ) : null}
                  </div>

                  {session.intervalStructure ? (
                    <p className="text-sm text-ink/75">
                      {session.intervalStructure}
                    </p>
                  ) : null}

                  {session.notes ? (
                    <p className="text-sm leading-6 text-ink/75">{session.notes}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/cardio?edit=${session.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Edit
                  </Link>
                  <form action={deleteCardioSessionAction}>
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
            {showAll ? "Show fewer" : `Show all ${sessions.length} workouts`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
