"use client";

import { useActionState } from "react";
import { logFeelingAction } from "@/features/recovery/actions";

/** Five taps on the 1-10 readiness scale; 3 or less caps the score at low. */
const OPTIONS = [
  { value: 2, label: "Rough" },
  { value: 4, label: "Meh" },
  { value: 6, label: "OK" },
  { value: 8, label: "Good" },
  { value: 10, label: "Great" },
] as const;

type FeelPickerProps = {
  date: string;
  /** Today's logged rating, 1-10, or null. */
  current: number | null;
};

export function FeelPicker({ date, current }: FeelPickerProps) {
  const [state, action, pending] = useActionState(logFeelingAction, {});
  const nearest =
    current == null
      ? null
      : OPTIONS.reduce((best, o) =>
          Math.abs(o.value - current) < Math.abs(best.value - current)
            ? o
            : best,
        ).value;

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="checkinDate" value={date} />
      <p className="text-sm text-ink/70">How do you feel this morning?</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="readinessLevel"
            value={o.value}
            disabled={pending}
            aria-pressed={nearest === o.value}
            className={`rounded-full border px-1 py-2 text-xs font-medium transition ${
              nearest === o.value
                ? "border-pine bg-pine text-white"
                : "border-ink/15 text-ink/70 hover:border-pine hover:text-pine"
            } disabled:opacity-60`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-ember">{state.error}</p>
      ) : null}
    </form>
  );
}
