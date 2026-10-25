import Link from "next/link";
import type {
  AdherenceSnapshot,
  ProgramSessionView,
  ProgramToday,
} from "../types";
import { AdherenceBanners, Scorecard, StreakLine } from "./adherence";
import { STATUS_LABEL, dayShort } from "../helpers";
import { KneeCheckPanel } from "./knee-check-panel";
import { MakeUpControl } from "./make-up-control";
import { SkipControl } from "./session-outcome-controls";
import { RIDE_KIND_LABEL, type WalkJogAdvice } from "@fitness-app/application";

/** "Oct 26" from YYYY-MM-DD, without timezone drift. */
function formatMonthDay(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

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

export function ProgramHeaderLine({
  today,
  compact = false,
}: {
  today: ProgramToday;
  /** One line: week and block only. */
  compact?: boolean;
}) {
  const { header } = today;
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">
        Week {header.week}
        {header.blockName ? ` · ${header.blockName}` : ""}
        {header.isDeload && compact ? " · Deload" : ""}
      </p>
      {!compact && header.nextBlock ? (
        <p className="mt-0.5 text-xs text-ink/60">
          Next block starts {formatMonthDay(header.nextBlock.date)} (
          {header.nextBlock.name})
        </p>
      ) : null}
      {!compact && (header.repScheme || header.isDeload) ? (
        <p className="mt-0.5 text-xs text-ink/60">
          {header.isDeload ? "Deload: one set fewer, no load increases. " : ""}
          {header.repScheme ?? ""}
        </p>
      ) : null}
    </>
  );
}

/** Logged today, or still to do (no skip or stop logged). */
export function isDone(session: Pick<ProgramSessionView, "completion">) {
  return session.completion === "done";
}

function isPending(
  session: Pick<ProgramSessionView, "completion" | "outcome" | "visible">,
) {
  return session.visible && !session.outcome && session.completion === "today";
}

/** Session list for one day; hidden sessions and exercises greyed with why. */
export function ProgramSessionList({
  sessions,
  testDayUrl,
  showExercises,
  date,
  walkJog = null,
  controls = false,
  loggedLiftId = null,
}: {
  sessions: ProgramSessionView[];
  testDayUrl: string | null;
  showExercises: boolean;
  date: string;
  walkJog?: WalkJogAdvice | null;
  /** Show Skip on today's sessions. */
  controls?: boolean;
  loggedLiftId?: string | null;
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-ink/60">Nothing planned.</p>;
  }
  return (
    <ul className="space-y-3">
      {sessions.map((s) => {
        const done = isDone(s);
        return (
          <li key={s.id} className={s.visible ? "" : "opacity-55"}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
              {done ? (
                s.type === "lift" && loggedLiftId ? (
                  <Link
                    href={`/strength/${loggedLiftId}`}
                    className="inline-flex h-11 items-center rounded-full bg-pine/10 px-4 text-xs font-semibold text-pine"
                  >
                    ✓ Done · View
                  </Link>
                ) : (
                  <span className="rounded-full bg-pine/10 px-3 py-1 text-xs font-semibold text-pine">
                    ✓ Done
                  </span>
                )
              ) : controls &&
                s.visible &&
                s.type !== "test" &&
                s.type !== "rest" ? (
                <SkipControl session={s} date={date} />
              ) : null}
              {s.type === "test" && testDayUrl ? (
                <a
                  href={testDayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center text-xs font-semibold text-pine underline"
                >
                  Open PT Tracker
                </a>
              ) : null}
            </div>
            {!s.visible && s.hiddenReason ? (
              <p className="text-xs text-ink/60">{s.hiddenReason}</p>
            ) : null}
            {s.visible && !done ? (
              <>
                {s.type === "walk_jog" && walkJog ? (
                  <p className="text-xs text-ink/70">{walkJogLine(walkJog)}</p>
                ) : null}
                {s.structure && s.type !== "walk_jog" ? (
                  <p className="text-xs text-ink/60">{s.structure}</p>
                ) : null}
                {rideLine(s) ? (
                  <p className="text-xs text-ink/70">{rideLine(s)}</p>
                ) : s.estimatedMinutes != null ? (
                  <p
                    className={`text-xs ${s.overBudget ? "font-medium text-ember" : "text-ink/60"}`}
                  >
                    About {s.estimatedMinutes} min
                    {s.overBudget ? " · over the time budget" : ""}
                  </p>
                ) : null}
                {s.ride?.structure ? (
                  <p className="text-xs text-ink/60">{s.ride.structure}</p>
                ) : null}
                {s.ride?.note ? (
                  <p className="text-xs font-medium text-ember">
                    {s.ride.note}
                  </p>
                ) : null}
                {s.legBlockReplaced ? (
                  <p className="mt-1 text-xs font-medium text-ember">
                    Leg block today: ROM + easy walk. Upper still runs.
                  </p>
                ) : null}
              </>
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
                        {e.superset ? (
                          <span className="mr-1 font-semibold tabular-nums text-ink/60">
                            {e.superset}
                          </span>
                        ) : null}
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
        );
      })}
    </ul>
  );
}

type ProgramTodayCardProps = {
  today: ProgramToday;
  /** This week's banners (and, on /program, the scorecard); null hides them. */
  snapshot?: AdherenceSnapshot | null;
  /** The program page shows exercise detail; the dashboard keeps it short. */
  detailed?: boolean;
};

/**
 * Today's program. The dashboard version answers one question, what is left
 * today: a session reads Done once it is logged and its buttons go away.
 */
export function ProgramTodayCard({
  today,
  detailed = false,
  snapshot = null,
}: ProgramTodayCardProps) {
  const isSunday = new Date(`${today.today}T12:00:00Z`).getUTCDay() === 0;
  const lift = today.sessions.find((s) => s.type === "lift" && s.visible);
  const ride = today.sessions.find((s) => s.type === "peloton" && s.visible);
  const liftPending = lift != null && isPending(lift);
  const ridePending = ride != null && isPending(ride);
  const tracked = today.sessions.filter((s) => s.scheduled);
  const allDone = tracked.length > 0 && tracked.every(isDone);
  const sleepLow =
    today.sleepAverageHours != null &&
    today.sleepAverageHours < today.sleepMinHours;
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ProgramHeaderLine today={today} compact={!detailed} />
          <h2 className="mt-1 font-display text-lg text-ink">
            {allDone ? "Today: done" : "Today"}
          </h2>
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

      {/* Once the lift is logged the check has done its job. */}
      {lift && isDone(lift) && today.kneeCheck ? null : (
        <KneeCheckPanel
          date={today.today}
          check={today.kneeCheck}
          status={today.kneeStatus}
          required={liftPending}
        />
      )}

      {detailed && liftPending && today.warmUp ? (
        <p className="rounded-2xl bg-pine/5 px-4 py-3 text-xs text-ink/75">
          <span className="font-semibold text-ink">Warm-up, 5 min: </span>
          {today.warmUp}
          {today.gaitDrill ? (
            <>
              <br />
              <span className="font-semibold text-ink">
                Gait drill, 3 min:{" "}
              </span>
              {today.gaitDrill}
            </>
          ) : null}
        </p>
      ) : null}

      {snapshot ? <AdherenceBanners snapshot={snapshot} /> : null}

      {today.makeUps.map((m) => (
        <div
          key={`${m.sessionId}-${m.date}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-pine/25 bg-pine/5 px-4 py-3"
        >
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink">
              {m.pendingOn ? "Make-up today" : "Missed"}{" "}
              {dayShort(new Date(`${m.date}T12:00:00Z`).getUTCDay())}: {m.name}
            </p>
            <p className="text-xs text-ink/60">
              {m.pendingOn
                ? "The ride you log or sync today counts for that day."
                : (m.warning ??
                  (m.kind === "lift"
                    ? "No lift today, so you can make it up."
                    : "No ride today, so you can make it up."))}
            </p>
          </div>
          <MakeUpControl
            kind={m.kind}
            sessionId={m.sessionId}
            date={m.date}
            href={m.href}
            pending={m.pendingOn != null}
            variant="button"
          />
        </div>
      ))}

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

      {sleepLow && liftPending ? (
        <p className="rounded-2xl border border-ink/10 bg-sand/60 px-4 py-2 text-xs text-ink/75">
          Sleep averaged {today.sleepAverageHours?.toFixed(1)} h: no load
          increases until it is back to {today.sleepMinHours} h.
        </p>
      ) : null}

      {today.quadDrop && liftPending ? (
        <p className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-2 text-xs text-ink/80">
          Left quad down {today.quadDrop.dropN} N on the {today.quadDrop.date}{" "}
          crane test: hold leg loads. Check sleep, swelling and load.
        </p>
      ) : null}

      <ProgramSessionList
        sessions={today.sessions}
        testDayUrl={today.testDayUrl}
        showExercises={detailed}
        date={today.today}
        walkJog={today.walkJog}
        loggedLiftId={today.loggedLiftId}
        controls
      />

      {detailed && snapshot ? (
        <div className="space-y-1.5">
          <Scorecard adherence={snapshot.adherence} inProgress />
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

      {liftPending || ridePending ? (
        <div className="flex flex-wrap items-center gap-2">
          {liftPending ? (
            <Link
              href="/strength"
              className="inline-flex h-11 items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white"
            >
              Start lift
            </Link>
          ) : null}
          {ridePending ? (
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
