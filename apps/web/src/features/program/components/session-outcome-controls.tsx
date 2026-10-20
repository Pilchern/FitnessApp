"use client";

import { useActionState, useState } from "react";
import { clearSessionOutcomeAction, logSessionOutcomeAction } from "../actions";
import type { ProgramSessionView } from "../types";
import { SKIP_LABELS } from "../helpers";

const SKIP_REASONS = ["time", "knee", "sick", "travel", "other"] as const;
const RED_FLAGS = ["giving_way", "locking", "sharp_pain"] as const;

function errorText(state: {
  error?: string;
  fieldErrors?: Record<string, string>;
}) {
  return state.error ?? Object.values(state.fieldErrors ?? {}).join(" ");
}

/**
 * "Skip" with a reason picker, so a missed session is a logged choice. Shows
 * the logged skip or stop with an undo.
 */
export function SkipControl({
  session,
  date,
}: {
  session: Pick<ProgramSessionView, "id" | "outcome">;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(logSessionOutcomeAction, {});
  const [undoState, undo, undoing] = useActionState(
    clearSessionOutcomeAction,
    {},
  );

  if (session.outcome) {
    const label =
      session.outcome.outcome === "stopped"
        ? `Stopped · ${SKIP_LABELS[session.outcome.reason]}`
        : `Skipped · ${SKIP_LABELS[session.outcome.reason]}`;
    return (
      <form action={undo} className="flex items-center gap-3">
        <input type="hidden" name="programSessionId" value={session.id} />
        <input type="hidden" name="date" value={date} />
        <span className="text-xs font-semibold text-ember">{label}</span>
        <button
          type="submit"
          disabled={undoing}
          className="h-11 rounded-full border border-ink/15 px-4 text-xs font-semibold text-ink disabled:opacity-60"
        >
          Undo
        </button>
        {errorText(undoState) ? (
          <span className="text-xs text-ember">{errorText(undoState)}</span>
        ) : null}
      </form>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-full border border-ink/15 px-4 text-xs font-semibold text-ink/70"
      >
        Skip
      </button>
    );
  }

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="programSessionId" value={session.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="outcome" value="skipped" />
      <p className="text-xs text-ink/65">Why skip?</p>
      <div className="flex flex-wrap gap-2">
        {SKIP_REASONS.map((reason) => (
          <button
            key={reason}
            type="submit"
            name="reason"
            value={reason}
            disabled={pending}
            className="h-11 rounded-full border border-ink/15 bg-white px-3 text-xs font-semibold text-ink active:bg-ember/10 disabled:opacity-60"
          >
            {SKIP_LABELS[reason]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 px-3 text-xs text-ink/55 underline"
        >
          Cancel
        </button>
      </div>
      {errorText(state) ? (
        <p className="text-xs text-ember">{errorText(state)}</p>
      ) : null}
    </form>
  );
}

/**
 * Red flag during a lift: giving way, locking or sharp pain. Logs the stop
 * and shows who to call. The number comes from Settings.
 */
export function RedFlagControl({
  sessionId,
  date,
  contact,
}: {
  sessionId: string;
  date: string;
  contact: { name: string; phone: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(logSessionOutcomeAction, {});

  if (state.saved) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-ember/40 bg-ember/15 px-4 py-3 text-ember"
      >
        <p className="text-base font-semibold">Stop the session.</p>
        <p className="mt-1 text-sm text-ink">
          Call {contact.name}
          {contact.phone ? (
            <>
              :{" "}
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="font-semibold text-ember underline"
              >
                {contact.phone}
              </a>
            </>
          ) : (
            ". Add their number in Settings."
          )}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-full border border-ember/40 px-4 text-xs font-semibold text-ember"
      >
        Red flag
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-1.5 rounded-2xl border border-ember/30 bg-ember/5 p-3"
    >
      <input type="hidden" name="programSessionId" value={sessionId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="outcome" value="stopped" />
      <p className="text-sm font-semibold text-ember">What happened?</p>
      <div className="grid grid-cols-3 gap-1.5">
        {RED_FLAGS.map((reason) => (
          <button
            key={reason}
            type="submit"
            name="reason"
            value={reason}
            disabled={pending}
            className="h-11 rounded-xl border border-ember/30 bg-white text-xs font-semibold text-ember disabled:opacity-60"
          >
            {SKIP_LABELS[reason]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-11 px-1 text-xs text-ink/55 underline"
      >
        Cancel
      </button>
      {errorText(state) ? (
        <p className="text-xs text-ember">{errorText(state)}</p>
      ) : null}
    </form>
  );
}
