import Link from "next/link";
import type { ProgramSessionView, ProgramToday } from "../types";
import { STATUS_LABEL } from "../helpers";
import { KneeCheckPanel } from "./knee-check-panel";

function rideLine(session: ProgramSessionView) {
  const ride = session.ride;
  if (!ride) return null;
  const minutes =
    ride.minutesMin != null && ride.minutesMax != null
      ? ride.minutesMin === ride.minutesMax
        ? `${ride.minutesMin} min`
        : `${ride.minutesMin}–${ride.minutesMax} min`
      : null;
  const kind = ride.kind === "zone2" ? "Zone 2" : "Climb intervals";
  return [kind, minutes].filter(Boolean).join(", ");
}

export function ProgramHeaderLine({ today }: { today: ProgramToday }) {
  const { header } = today;
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">
        Post-op week {header.week}
        {header.blockName ? ` · ${header.blockName}` : ""}
      </p>
      {header.repScheme || header.isDeload ? (
        <p className="mt-0.5 text-xs text-ink/60">
          {header.isDeload ? "Deload: one set fewer, no load increases. " : ""}
          {header.repScheme ?? ""}
        </p>
      ) : null}
    </>
  );
}

/** Session list for one day; hidden sessions and exercises greyed with why. */
export function ProgramSessionList({
  sessions,
  testDayUrl,
  showExercises,
}: {
  sessions: ProgramSessionView[];
  testDayUrl: string | null;
  showExercises: boolean;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-ink/60">Nothing planned.</p>;
  }
  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <li key={s.id} className={s.visible ? "" : "opacity-55"}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-semibold text-ink">
              {s.name}
              {s.upperTemplateName ? (
                <span className="font-normal text-ink/60">
                  {" "}
                  then {s.upperTemplateName}
                </span>
              ) : null}
            </span>
            {s.type === "test" && testDayUrl ? (
              <a
                href={testDayUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-pine underline"
              >
                Open PT Tracker
              </a>
            ) : null}
          </div>
          {!s.visible && s.hiddenReason ? (
            <p className="text-xs text-ink/60">{s.hiddenReason}</p>
          ) : null}
          {rideLine(s) ? (
            <p className="text-xs text-ink/70">{rideLine(s)}</p>
          ) : null}
          {s.ride?.structure ? (
            <p className="text-xs text-ink/60">{s.ride.structure}</p>
          ) : null}
          {s.ride?.note ? (
            <p className="text-xs font-medium text-ember">{s.ride.note}</p>
          ) : null}
          {s.legBlockReplaced ? (
            <p className="mt-1 text-xs font-medium text-ember">
              Leg block today: 15 min ROM + easy walk.
            </p>
          ) : null}
          {showExercises && s.visible && !s.legBlockReplaced ? (
            <ul className="mt-1.5 space-y-1">
              {s.exercises.map((e) => {
                const off =
                  e.status === "locked" || e.status === "readiness_hidden";
                return (
                  <li
                    key={`${s.id}-${e.name}`}
                    className={`flex flex-wrap justify-between gap-x-2 text-xs ${off ? "text-ink/40" : "text-ink/75"}`}
                  >
                    <span className="min-w-0">
                      {e.name}
                      {STATUS_LABEL[e.status] ? (
                        <span className="ml-1.5 rounded-full border border-ink/15 px-1.5 py-px text-[0.65rem] uppercase tracking-wide">
                          {STATUS_LABEL[e.status]}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">
                      {off ? e.lockedReason : e.prescription}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type ProgramTodayCardProps = {
  today: ProgramToday;
  /** The program page shows exercise detail; the dashboard keeps it short. */
  detailed?: boolean;
};

export function ProgramTodayCard({
  today,
  detailed = false,
}: ProgramTodayCardProps) {
  const hasRide = today.sessions.some((s) => s.type === "peloton" && s.visible);
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ProgramHeaderLine today={today} />
          <h2 className="mt-1 font-display text-lg text-ink">Today</h2>
        </div>
        {!detailed ? (
          <Link
            href="/program"
            className="shrink-0 text-sm font-semibold text-pine"
          >
            Program →
          </Link>
        ) : null}
      </div>

      <KneeCheckPanel
        date={today.today}
        check={today.kneeCheck}
        status={today.kneeStatus}
        required={today.hasLift}
      />

      <ProgramSessionList
        sessions={today.sessions}
        testDayUrl={today.testDayUrl}
        showExercises={detailed}
      />

      {today.hasLift || hasRide ? (
        <div className="flex flex-wrap gap-2">
          {today.hasLift ? (
            <Link
              href="/strength"
              className="inline-flex h-11 items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white"
            >
              Start lift
            </Link>
          ) : null}
          {hasRide ? (
            <Link
              href="/cardio"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink"
            >
              Log ride
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
