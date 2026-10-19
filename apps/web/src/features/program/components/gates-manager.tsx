"use client";

import { useActionState } from "react";
import type { ProgramGate } from "@fitness-app/domain";
import { setGateAction } from "../actions";

function GateRow({ gate, today }: { gate: ProgramGate; today: string }) {
  const [state, action, pending] = useActionState(setGateAction, {});
  const error = state.error ?? Object.values(state.fieldErrors ?? {}).join(" ");
  return (
    <li className="py-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="gateKey" value={gate.gateKey} />
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-ink">{gate.label}</p>
          <span
            className={`shrink-0 text-xs ${gate.clearedOn ? "text-pine" : "text-ink/50"}`}
          >
            {gate.clearedOn
              ? `Cleared ${gate.clearedOn}`
              : gate.earliestOn
                ? `Earliest ${gate.earliestOn}`
                : "Not cleared"}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            name="clearedOn"
            aria-label={`${gate.label} cleared on`}
            defaultValue={gate.clearedOn ?? today}
            className="h-11 min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink"
          />
          <button
            type="submit"
            name="intent"
            value="clear"
            disabled={pending}
            className="h-11 shrink-0 rounded-full bg-pine px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {gate.clearedOn ? "Update" : "Cleared"}
          </button>
          {gate.clearedOn ? (
            <button
              type="submit"
              name="intent"
              value="reset"
              disabled={pending}
              className="h-11 shrink-0 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink disabled:opacity-60"
            >
              Reset
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-ember">
            {error}
          </p>
        ) : null}
      </form>
    </li>
  );
}

/**
 * Manual gates: an exercise or session with a gate stays hidden or greyed
 * until its gate is cleared, from the date given.
 */
export function GatesManager({
  gates,
  today,
}: {
  gates: ProgramGate[];
  today: string;
}) {
  if (gates.length === 0) return null;
  return (
    <section
      id="gates"
      className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6"
    >
      <h2 className="font-display text-lg text-ink">Program gates</h2>
      <p className="mt-1 text-sm text-ink/60">
        Set the date PT or the surgeon cleared each one. Gated exercises run
        their fallback until then.
      </p>
      <p className="mt-2 rounded-2xl bg-pine/5 px-4 py-3 text-xs text-ink/75">
        The PT Tracker evaluates the criteria. Quad LSI is a hard criterion.
        Walking asymmetry is soft: under 8% and trending down over 3 weeks.
      </p>
      <ul className="mt-2 divide-y divide-ink/10">
        {gates.map((g) => (
          <GateRow key={g.gateKey} gate={g} today={today} />
        ))}
      </ul>
    </section>
  );
}
