import Link from "next/link";
import { notFound } from "next/navigation";
import type { StrengthExerciseSet } from "@fitness-app/domain";
import { StrengthProgressionSummarySection } from "./strength-progression-summary";
import { getStrengthDetailData } from "../server";
import { formatStrengthDate } from "../helpers";

type StrengthDetailScreenProps = {
  sessionId: string;
};

export async function StrengthDetailScreen({
  sessionId,
}: StrengthDetailScreenProps) {
  const data = await getStrengthDetailData(sessionId);

  if (!data.session) {
    notFound();
  }

  const session = data.session;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
              Session
            </p>
            <h1 className="mt-3 font-display text-4xl text-ink">
              {session.sessionName ?? "Strength session"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink/80">
              {formatStrengthDate(session.sessionDate)}. {session.sets.length} sets across{" "}
              {new Set(session.sets.map((set: StrengthExerciseSet) => set.exerciseName)).size} exercises.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/strength?edit=${session.id}`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Edit session
            </Link>
            <Link
              href="/strength"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 px-5 text-sm font-semibold text-ink/70 transition hover:border-pine hover:text-pine"
            >
              Back to list
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Duration</div>
            <div className="mt-2 text-2xl font-semibold text-ink">
              {session.durationMinutes != null ? `${session.durationMinutes} min` : "--"}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Readiness</div>
            <div className="mt-2 text-2xl font-semibold text-ink">
              {session.readinessPre != null ? `${session.readinessPre}/10` : "--"}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Energy after</div>
            <div className="mt-2 text-2xl font-semibold text-ink">
              {session.energyPost != null ? `${session.energyPost}/10` : "--"}
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Plan match</div>
            <div className="mt-2 text-2xl font-semibold text-ink">
              {session.completedAsPlanned ? "Yes" : "Adjusted"}
            </div>
          </div>
        </div>

        {session.notes ? (
          <p className="mt-5 text-sm leading-6 text-ink/75">{session.notes}</p>
        ) : null}
      </section>

      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Logged sets
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Set detail</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-ink/80">
            <thead className="text-xs uppercase tracking-[0.18em] text-ink/55">
              <tr>
                <th className="pb-3 pr-4">Exercise</th>
                <th className="pb-3 pr-4">Set</th>
                <th className="pb-3 pr-4">Reps</th>
                <th className="pb-3 pr-4">Weight</th>
                <th className="pb-3 pr-4">RIR</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {session.sets.map((set: StrengthExerciseSet) => (
                <tr key={set.id} className="border-t border-ink/10">
                  <td className="py-3 pr-4 font-semibold text-ink">{set.exerciseName}</td>
                  <td className="py-3 pr-4">{set.setNumber}</td>
                  <td className="py-3 pr-4">{set.reps ?? "--"}</td>
                  <td className="py-3 pr-4">{set.weight ?? "--"}</td>
                  <td className="py-3 pr-4">{set.rir ?? "--"}</td>
                  <td className="py-3">{set.notes ?? "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <StrengthProgressionSummarySection
        summaries={data.exerciseProgressionSummaries}
        title="Exercise trends"
        description="How the movements from this session are trending across all your logged history."
      />
    </div>
  );
}
