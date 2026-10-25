"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cancelRideMakeUpAction, setRideMakeUpAction } from "../actions";

/**
 * "Make up" for a missed lift (opens the logger on that session) or ride
 * (sets today's ride to count for it), and "Cancel" on a ride make-up that
 * is waiting on a ride.
 */
export function MakeUpControl({
  kind,
  sessionId,
  date,
  href,
  pending,
  variant = "link",
}: {
  kind: "lift" | "ride";
  sessionId: string;
  /** The missed session's scheduled date. */
  date: string;
  href: string | null;
  /** A ride make-up already set for today. */
  pending: boolean;
  variant?: "link" | "button";
}) {
  const [setState, setAction, setting] = useActionState(
    setRideMakeUpAction,
    {},
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelRideMakeUpAction,
    {},
  );
  const button =
    variant === "button"
      ? "inline-flex h-11 shrink-0 items-center rounded-full bg-pine px-4 text-sm font-semibold text-white disabled:opacity-60"
      : "font-semibold text-pine underline-offset-2 hover:underline disabled:opacity-60";
  const error = setState.error ?? cancelState.error;

  if (kind === "lift" && href) {
    return (
      <Link href={href} className={button}>
        Make up
      </Link>
    );
  }
  return (
    <form action={pending ? cancelAction : setAction} className="inline">
      <input type="hidden" name="programSessionId" value={sessionId} />
      <input type="hidden" name="date" value={date} />
      <button
        type="submit"
        disabled={setting || cancelling}
        className={
          pending && variant === "button"
            ? "inline-flex h-11 shrink-0 items-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink disabled:opacity-60"
            : button
        }
      >
        {pending ? "Cancel" : "Make up today"}
      </button>
      {error ? <span className="ml-2 text-xs text-ember">{error}</span> : null}
    </form>
  );
}
