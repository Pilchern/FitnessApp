"use client";

import Link from "next/link";
import type { LoggerPlan } from "@fitness-app/application";
import type { StrengthProgramPlan } from "../types";
import { KneeCheckPanel } from "./knee-check-panel";
import { ProgramHeaderLine } from "./program-today-card";
import { RedFlagControl, SkipControl } from "./session-outcome-controls";

type ProgramPlanCalloutProps = {
  programPlan: StrengthProgramPlan;
  onStart: (plan: LoggerPlan) => void;
};

/**
 * Today's program lift on /strength. The knee check comes first; Start loads
 * the leg block (with suggested loads) and the upper template into the logger.
 */
export function ProgramPlanCallout({
  programPlan,
  onStart,
}: ProgramPlanCalloutProps) {
  const { today, plan } = programPlan;
  const lift = today.sessions.find((s) => s.type === "lift" && s.visible);

  // Logged: say so and get out of the way. The logger below still works for
  // an extra session.
  if (lift?.completion === "done") {
    return (
      <section className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-pine/30 bg-pine/5 p-4 shadow-panel sm:p-6">
        <div className="min-w-0">
          <ProgramHeaderLine today={today} compact />
          <h2 className="mt-1 font-display text-xl text-ink">
            {lift.name}: done
          </h2>
        </div>
        {today.loggedLiftId ? (
          <Link
            href={`/strength/${today.loggedLiftId}`}
            className="shrink-0 text-sm font-semibold text-pine"
          >
            View →
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-[1.75rem] border border-pine/30 bg-pine/5 p-4 shadow-panel sm:p-6">
      <div>
        <ProgramHeaderLine today={today} compact />
        <h2 className="mt-1 font-display text-2xl text-ink">
          {lift?.name ?? "Today's lift"}
        </h2>
        {lift?.upperTemplateName ? (
          <p className="text-sm text-ink/65">then {lift.upperTemplateName}</p>
        ) : null}
      </div>

      {today.showGoBackWeek ? (
        <p
          role="alert"
          className="rounded-2xl border border-ember/40 bg-ember/15 px-4 py-3 text-sm font-semibold text-ember"
        >
          {today.kneeOffStreak} knee-off days in a row: go back one week on leg
          loads; tell PT.
        </p>
      ) : null}

      <KneeCheckPanel
        date={today.today}
        check={today.kneeCheck}
        status={today.kneeStatus}
        required
      />

      {today.warmUp ? (
        <p className="text-xs text-ink/70">
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

      {lift ? (
        <div className="flex flex-wrap items-center gap-2">
          <SkipControl session={lift} date={today.today} />
          {!lift.outcome ? (
            <RedFlagControl
              sessionId={programPlan.sessionId}
              date={today.today}
              contact={today.redFlag}
            />
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <>
          <p className="text-sm text-ink/70">
            {plan.exercises.map((ex) => ex.exerciseName).join(" · ")}
          </p>
          <button
            type="button"
            onClick={() => onStart(plan)}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white transition hover:bg-pine/90 sm:w-auto"
          >
            Start workout
          </button>
        </>
      ) : (
        <p className="text-sm text-ink/60">
          Answer the knee check to load today&apos;s session.
        </p>
      )}
    </section>
  );
}
