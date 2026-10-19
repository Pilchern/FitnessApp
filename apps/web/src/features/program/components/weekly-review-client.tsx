"use client";

import { useActionState, useState } from "react";
import type { ProgramWeeklyCheckin } from "@fitness-app/domain";
import { saveWeeklyCheckinAction } from "../actions";

const field =
  "h-11 w-full min-w-0 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink";

/** The manual entries: PT visits, quad LSI (PT Tracker), walking asymmetry. */
export function WeeklyCheckinForm({
  weekStart,
  checkin,
  defaultScheduled,
}: {
  weekStart: string;
  checkin: ProgramWeeklyCheckin | null;
  defaultScheduled: number;
}) {
  const [state, action, pending] = useActionState(saveWeeklyCheckinAction, {});
  const error = state.error ?? Object.values(state.fieldErrors ?? {}).join(" ");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="weekStart" value={weekStart} />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-ink/70">
          PT visits scheduled
          <input
            name="ptVisitsScheduled"
            inputMode="numeric"
            defaultValue={checkin?.ptVisitsScheduled ?? defaultScheduled}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs text-ink/70">
          PT visits attended
          <input
            name="ptVisitsAttended"
            inputMode="numeric"
            defaultValue={checkin?.ptVisitsAttended ?? ""}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs text-ink/70">
          Quad LSI % (PT Tracker)
          <input
            name="quadLsiPct"
            inputMode="decimal"
            defaultValue={checkin?.quadLsiPct ?? ""}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs text-ink/70">
          Walking asymmetry % (Health)
          <input
            name="walkingAsymmetryPct"
            inputMode="decimal"
            defaultValue={checkin?.walkingAsymmetryPct ?? ""}
            className={field}
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs text-ink/70">
        Notes
        <textarea
          name="notes"
          defaultValue={checkin?.notes ?? ""}
          className="min-h-20 rounded-xl border border-ink/10 bg-white px-3 py-2 text-base text-ink"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-full bg-pine px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {state.saved && !pending ? (
          <span className="text-xs text-pine">Saved.</span>
        ) : null}
        {error ? <span className="text-xs text-ember">{error}</span> : null}
      </div>
    </form>
  );
}

/** Copies the plain-text summary for the LifeOS Sunday review. */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={copy}
        className="h-11 w-full rounded-full bg-pine px-5 text-sm font-semibold text-white"
      >
        {copied === "done" ? "Copied" : "Copy summary"}
      </button>
      {copied === "failed" ? (
        <textarea
          readOnly
          value={text}
          aria-label="Summary text"
          className="min-h-48 w-full rounded-xl border border-ink/10 bg-white p-3 text-xs text-ink"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
