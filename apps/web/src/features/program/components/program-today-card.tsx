import Link from "next/link";
import type {
  AdherenceSnapshot,
  ProgramSessionView,
  ProgramToday,
} from "../types";
import { AdherenceBanners, Scorecard, StreakLine } from "./adherence";
import { STATUS_LABEL } from "../helpers";
import { KneeCheckPanel } from "./knee-check-panel";
import { RedFlagControl, SkipControl } from "./session-outcome-controls";
import { RIDE_KIND_LABEL, type WalkJogAdvice } from "@fitness-app/application";

function walkJogLine(advice: WalkJogAdvice) {
  if (advice.action === "rest") {
    return `Rest from running (bike instead). Back on ${advice.resumeOn}.`;
  }
  const minutes =
    advice.runMinutesMin === advice.runMinutesMax
      ? `${advice.runMinutesMin}`
      : `${advice.runMinutesMin}–${advice.runMinutesMax}`;
  return `${minutes} min running: ${advice.structure}. ${advice.reason}`;
}

function rideLine(session: ProgramSessionView) {
  const ride = session.ride;
  if (!ride) return null;
  const minutes =
    ride.minutesMin != null && ride.minutesMax != null
      ? ride.minutesMin === ride.minutesMax
        ? `${ride.minutesMin} min`
        : `${ride.minutesMin}–${ride.minutesMax} min`
      : null;
  const kind = RIDE_KIND_LABEL[ride.kind];
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
  date,
  walkJog = null,
  controls = false,
}: {
  sessions: ProgramSessionView[];
  testDayUrl: string | null;
  showExercises: boolean;
  date: string;
  walkJog?: WalkJogAdvice | null;
  /** Show Skip on today's sessions. */
  controls?: boolean;
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
              {s.isOptional ? (
                <span className="font-normal text-ink/60"> (optional)</span>
              ) : null}
              {s.upperTemplateName ? (
                <span className="font-normal text-ink/60">
                  {" "}
                  then {s.upperTemplateName}
                </span>
              ) : null}
            </span>
            {controls && s.visible && s.type !== "test" && s.type !== "rest" ? (
              <SkipControl session={s} date={date} />
            ) : null}
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
          {s.type === "walk_jog" && s.visible && walkJog ? (
            <p className="text-xs text-ink/70">{walkJogLine(walkJog)}</p>
          ) : null}
          {s.structure && s.visible && s.type !== "walk_jog" ? (
            <p className="text-xs text-ink/60">{s.structure}</p>
          ) : null}
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
              Leg block today: ROM + easy walk. Upper still runs.
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
                    {e.cue && !off ? (
                      <span className="w-full text-[0.7rem] text-ink/50">
                        {e.cue}
                      </span>
                    ) : null}
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
  /** This week's scorecard and banners; null hides them. */
  snapshot?: AdherenceSnapshot | null;
  /** The program page shows exercise detail; the dashboard keeps it short. */
  detailed?: boolean;
};

export function ProgramTodayCard({
  today,
  detailed = false,
  snapshot = null,
}: ProgramTodayCardProps) {
  const isSunday = new Date(`${today.today}T12:00:00Z`).getUTCDay() === 0;
  const hasRide = today.sessions.some((s) => s.type === "peloton" && s.visible);
  const lift = today.sessions.find((s) => s.type === "lift" && s.visible);
  const sleepLow =
    today.sleepAverageHours != null &&
    today.sleepAverageHours < today.sleepMinHours;
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

      {lift && today.warmUp ? (
        <p className="rounded-2xl bg-pine/5 px-4 py-3 text-xs text-ink/75">
          <span className="font-semibold text-ink">Warm-up, 8 min: </span>
          {today.warmUp}
        </p>
      ) : null}

      {snapshot ? <AdherenceBanners snapshot={snapshot} /> : null}

      {today.showGoBackWeek ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/40 bg-ember/15 px-4 py-3 text-sm text-ember"
        >
          <p className="font-semibold">
            {today.kneeOffStreak} knee-off days in a row.
          </p>
          <p className="mt-0.5 text-ink/80">
            Go back one week on leg loads; tell PT.
          </p>
        </div>
      ) : null}

      {sleepLow ? (
        <p className="rounded-2xl border border-ink/10 bg-sand/60 px-4 py-2 text-xs text-ink/75">
          Sleep averaged {today.sleepAverageHours?.toFixed(1)} h: no load
          increases until it is back to {today.sleepMinHours} h.
        </p>
      ) : null}

      <ProgramSessionList
        sessions={today.sessions}
        testDayUrl={today.testDayUrl}
        showExercises={detailed}
        date={today.today}
        walkJog={today.walkJog}
        controls
      />

      {snapshot ? (
        <div className="space-y-1.5">
          <Scorecard adherence={snapshot.adherence} />
          <StreakLine snapshot={snapshot} />
        </div>
      ) : null}

      {isSunday ? (
        <Link
          href="/program/review"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white"
        >
          Sunday review
        </Link>
      ) : null}

      {today.hasLift || hasRide ? (
        <div className="flex flex-wrap items-center gap-2">
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
          {lift && !lift.outcome ? (
            <RedFlagControl
              sessionId={lift.id}
              date={today.today}
              contact={today.redFlag}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
