"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CLEARED_BY, CLEARED_BY_LABEL } from "@fitness-app/application";
import type { ProgramGate } from "@fitness-app/domain";
import { setGateAction, setGateClinicianOkAction } from "../actions";

/** Gates with a criteria board on Knee tests: they take a clinician OK. */
const BOARD_GATES = new Set(["jog", "plyo_double", "rts"]);

function ClinicianOkForm({
  gate,
  today,
}: {
  gate: ProgramGate;
  today: string;
}) {
  const [state, action, pending] = useActionState(setGateClinicianOkAction, {});
  const error = state.error ?? Object.values(state.fieldErrors ?? {}).join(" ");
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="gateKey" value={gate.gateKey} />
      <p className="text-xs text-ink/60">
        PT or ortho OK (one criterion; does not clear the gate):{" "}
        {gate.clinicianOkOn
          ? `${gate.clinicianOkOn}${gate.clinicianOkBy ? ` by ${CLEARED_BY_LABEL[gate.clinicianOkBy]}` : ""}`
          : "not recorded"}
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          name="clinicianOkBy"
          aria-label={`${gate.label} OK by`}
          defaultValue={gate.clinicianOkBy ?? "pt"}
          className="h-11 shrink-0 rounded-xl border border-ink/10 bg-white px-2 text-base text-ink"
        >
          <option value="pt">PT</option>
          <option value="ortho">ortho</option>
        </select>
        <input
          type="date"
          name="clinicianOkOn"
          aria-label={`${gate.label} OK on`}
          defaultValue={gate.clinicianOkOn ?? today}
          className="h-11 min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink"
        />
        <button
          type="submit"
          name="intent"
          value="ok"
          disabled={pending}
          className="h-11 shrink-0 rounded-full border border-pine/40 px-4 text-sm font-semibold text-pine disabled:opacity-60"
        >
          {gate.clinicianOkOn ? "Update OK" : "Record OK"}
        </button>
        {gate.clinicianOkOn ? (
          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            className="h-11 shrink-0 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            Remove OK
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-ember">
          {error}
        </p>
      ) : null}
    </form>
  );
}

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
              ? `Cleared ${gate.clearedOn}${gate.clearedBy ? ` by ${CLEARED_BY_LABEL[gate.clearedBy]}` : ""}`
              : gate.earliestOn
                ? `Earliest ${gate.earliestOn}`
                : "Not cleared"}
          </span>
        </div>
        {gate.criteria ? (
          <p className="text-xs leading-5 text-ink/60">{gate.criteria}</p>
        ) : null}
        {gate.notes ? (
          <p className="text-xs leading-5 text-ink/50">{gate.notes}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <select
            name="clearedBy"
            aria-label={`${gate.label} cleared by`}
            defaultValue={gate.clearedBy ?? "pt"}
            className="h-11 shrink-0 rounded-xl border border-ink/10 bg-white px-2 text-base text-ink"
          >
            {CLEARED_BY.map((by) => (
              <option key={by} value={by}>
                {CLEARED_BY_LABEL[by]}
              </option>
            ))}
          </select>
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
      {BOARD_GATES.has(gate.gateKey) ? (
        <div className="mt-2">
          <ClinicianOkForm gate={gate} today={today} />
        </div>
      ) : null}
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
        Each criterion for jog, plyo and return to sport shows green or red on{" "}
        <Link href="/program/knee" className="font-semibold text-pine">
          Knee tests
        </Link>
        .
      </p>
      <ul className="mt-2 divide-y divide-ink/10">
        {gates.map((g) => (
          <GateRow key={g.gateKey} gate={g} today={today} />
        ))}
      </ul>
    </section>
  );
}
