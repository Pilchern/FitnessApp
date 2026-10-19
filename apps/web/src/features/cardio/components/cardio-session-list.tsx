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
    templates.find((template) => template.id === session.trainingTemplateId)
      ?.name ?? null
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
          <h2 className="mt-4 font-display text-xl text-ink">
            No workouts yet
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Rides sync from Apple Health each hour. They will show up here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg text-ink">Recent workouts</h2>
        <div className="text-sm text-ink/55">{sessions.length} total</div>
      </div>

      {/* One row per workout; tap for the rest of the numbers, edit and delete. */}
      <ul className="mt-3 divide-y divide-ink/10">
        {visible.map((session) => {
          const templateName = findTemplateName(session, templates);
          const title = templateName ?? formatSessionKind(session.sessionKind);
          const summary = [
            session.durationMinutes != null
              ? `${session.durationMinutes} min`
              : null,
            session.avgHeartRate != null ? `HR ${session.avgHeartRate}` : null,
          ].filter(Boolean);
          const details = [
            session.sportType ? formatSportType(session.sportType) : null,
            session.runMinutes != null
              ? `Run ${session.runMinutes} / walk ${session.walkMinutes ?? 0} min`
              : null,
            session.totalOutputKj != null
              ? `${Math.round(session.totalOutputKj)} kJ`
              : null,
            session.avgOutput != null
              ? `Avg ${Math.round(session.avgOutput)} W`
              : null,
            session.zone2HeartRate != null
              ? `Z2 HR ${session.zone2HeartRate}`
              : null,
            session.best5MinWatts != null
              ? `Best 5 min ${session.best5MinWatts} W`
              : null,
            session.rpe != null ? `RPE ${session.rpe}` : null,
            session.distanceMeters != null
              ? `${(session.distanceMeters / 1000).toFixed(1)} km`
              : null,
          ].filter(Boolean);
          const notCompleted = session.plannedVsCompleted !== "completed";

          return (
            <li key={session.id}>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {formatCardioDate(session.sessionDate)}
                    </span>
                    <span className="block truncate text-xs text-ink/55">
                      {title}
                      {notCompleted ? (
                        <span
                          className={`ml-2 rounded-full border px-1.5 py-px text-[0.65rem] font-semibold uppercase tracking-wide ${sessionStatusClassName(session.plannedVsCompleted)}`}
                        >
                          {formatCompletionLabel(session.plannedVsCompleted)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm text-ink/65">
                    {summary.length > 0 ? summary.join(" · ") : "No data"}
                  </span>
                </summary>
                <div className="space-y-3 pb-4 text-sm text-ink/70">
                  {details.length > 0 ? <p>{details.join(" · ")}</p> : null}
                  {session.intervalStructure ? (
                    <p>{session.intervalStructure}</p>
                  ) : null}
                  {session.notes ? (
                    <p className="text-ink/80">{session.notes}</p>
                  ) : null}
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/cardio?edit=${session.id}`}
                      className="inline-flex min-h-10 items-center font-semibold text-pine hover:underline"
                    >
                      Edit
                    </Link>
                    <form
                      action={deleteCardioSessionAction}
                      onSubmit={(event) => {
                        if (!window.confirm("Delete this workout?")) {
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
                    {session.source.sourceType !== "manual" ? (
                      <span className="ml-auto text-xs text-ink/45">
                        {session.source.sourceProvider === "apple_health"
                          ? "Apple Health"
                          : session.source.sourceProvider}
                      </span>
                    ) : null}
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
            {showAll ? "Show fewer" : `Show all ${sessions.length} workouts`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
