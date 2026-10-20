"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type {
  KneeCheck,
  KneeReadinessStatus,
  KneeSwelling,
} from "@fitness-app/domain";
import { logKneeCheckAction } from "../actions";

const SWELLING: { value: KneeSwelling; label: string }[] = [
  { value: "none", label: "0" },
  { value: "trace", label: "Trace" },
  { value: "1+", label: "1+" },
  { value: "2+", label: "2+" },
];

const STATUS: Record<
  KneeReadinessStatus,
  { label: string; detail: string; tone: string }
> = {
  normal: {
    label: "Normal",
    detail: "Full session. Load increases allowed.",
    tone: "border-pine/25 bg-pine/10 text-pine",
  },
  hold: {
    label: "Repeat loads",
    detail: "Same loads as last time. Landing prep is off.",
    tone: "border-ember/20 bg-ember/5 text-ember",
  },
  knee_off: {
    label: "Knee day off",
    detail:
      "Leg block becomes 15 min ROM + walk. Upper still runs. Thursday intervals become Zone 2.",
    tone: "border-ember/40 bg-ember/15 text-ember",
  },
};

function choice(selected: boolean) {
  return `h-11 rounded-xl border text-sm font-semibold transition ${
    selected
      ? "border-pine bg-pine text-white"
      : "border-ink/15 bg-white text-ink/75 active:bg-pine/10"
  }`;
}

type KneeCheckPanelProps = {
  date: string;
  check: KneeCheck | null;
  status: KneeReadinessStatus | null;
  /** Lift days need the check before the session starts. */
  required?: boolean;
};

/**
 * Morning knee check: swelling, graft-site pain, extension. Saves on the
 * third answer. Shows the day's call once saved, with a way to redo it.
 */
export function KneeCheckPanel({
  date,
  check,
  status,
  required = false,
}: KneeCheckPanelProps) {
  const [state, action, pending] = useActionState(logKneeCheckAction, {});
  const [editing, setEditing] = useState(status == null);
  const [swelling, setSwelling] = useState<KneeSwelling | null>(
    check?.swelling ?? null,
  );
  const [pain, setPain] = useState<number | null>(check?.graftPain ?? null);
  const [extension, setExtension] = useState<boolean | null>(
    check?.extensionFull ?? null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (status != null) setEditing(false);
  }, [status]);

  useEffect(() => {
    if (!touched.current) return;
    if (swelling != null && pain != null && extension != null) {
      touched.current = false;
      formRef.current?.requestSubmit();
    }
  }, [swelling, pain, extension]);

  function pick<T>(setter: (v: T) => void, value: T) {
    touched.current = true;
    setter(value);
  }

  const error =
    state.error ?? Object.values(state.fieldErrors ?? {}).join(" ") ?? "";

  if (!editing && status) {
    const s = STATUS[status];
    return (
      <div className={`rounded-2xl border px-4 py-3 ${s.tone}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Knee check: {s.label}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-11 shrink-0 rounded-full border border-ink/15 bg-white/70 px-4 text-ink text-xs font-semibold"
          >
            Redo
          </button>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink/75">{s.detail}</p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-2xl border border-ink/10 bg-sand/40 p-3"
    >
      <input type="hidden" name="checkinDate" value={date} />
      <input type="hidden" name="swelling" value={swelling ?? ""} />
      <input type="hidden" name="graftPain" value={pain ?? ""} />
      <input
        type="hidden"
        name="extensionFull"
        value={extension == null ? "" : extension ? "yes" : "no"}
      />
      <p className="text-sm font-semibold text-ink">
        Knee check{required ? " (before you lift)" : ""}
      </p>

      <fieldset>
        <legend className="text-xs text-ink/65">Morning swelling</legend>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {SWELLING.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={swelling === o.value}
              onClick={() => pick(setSwelling, o.value)}
              className={choice(swelling === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-ink/65">
          Pain below the kneecap (0–10)
        </legend>
        <div className="mt-1.5 grid grid-cols-6 gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-pressed={pain === n}
              aria-label={`Pain ${n}`}
              onClick={() => pick(setPain, n)}
              className={choice(pain === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-ink/65">Extension feels full?</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={extension === v}
              onClick={() => pick(setExtension, v)}
              className={choice(extension === v)}
            >
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>

      {pending ? <p className="text-xs text-ink/60">Saving...</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-ember">
          {error}
        </p>
      ) : null}
      {status && !pending ? (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-11 text-xs font-semibold text-ink/60 underline"
        >
          Keep today&apos;s answer
        </button>
      ) : null}
    </form>
  );
}
