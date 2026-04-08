"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { BodyMetric } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { toBodyFormValues } from "../helpers";
import type { BodyActionState, BodyFormValues } from "../types";

type BodyQuickFormProps = {
  mode: "create" | "edit";
  metric: BodyMetric | null;
  action: (
    state: BodyActionState,
    formData: FormData,
  ) => Promise<BodyActionState>;
  formError?: string;
};

const initialState: BodyActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

export function BodyQuickForm({
  mode,
  metric,
  action,
  formError,
}: BodyQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<BodyFormValues>(() => toBodyFormValues(metric));
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");

  useEffect(() => {
    setValues(toBodyFormValues(metric));
    setShowAdvanced(mode === "edit");
  }, [metric, mode]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Quick add
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit" ? "Edit body metrics" : "Log body metrics fast"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Weight and waist first. Body fat, muscle mass, and notes stay out of
            the way until you need them.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/body"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            Cancel edit
          </Link>
        ) : null}
      </div>

      {formError || state.error ? (
        <div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {formError ?? state.error}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 space-y-5">
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
        <input type="hidden" name="sourceType" value={values.sourceType} />

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              name="measuredOn"
              type="date"
              value={values.measuredOn}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  measuredOn: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.measuredOn ? (
              <p className="text-xs text-ember">{state.fieldErrors.measuredOn}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Weight (lb)
            <input
              className={fieldClassName()}
              name="weightLb"
              inputMode="decimal"
              placeholder="189.4"
              value={values.weightLb}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  weightLb: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.weightLb ? (
              <p className="text-xs text-ember">{state.fieldErrors.weightLb}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Waist (in)
            <input
              className={fieldClassName()}
              name="waistIn"
              inputMode="decimal"
              placeholder="34.1"
              value={values.waistIn}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  waistIn: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.waistIn ? (
              <p className="text-xs text-ember">{state.fieldErrors.waistIn}</p>
            ) : null}
          </label>

        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showAdvanced ? "Hide optional fields" : "Add body fat, muscle, or notes"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Body fat (%)
              <input
                className={fieldClassName()}
                name="bodyFatPct"
                inputMode="decimal"
                value={values.bodyFatPct}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    bodyFatPct: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.bodyFatPct ? (
                <p className="text-xs text-ember">{state.fieldErrors.bodyFatPct}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Muscle mass (lb)
              <input
                className={fieldClassName()}
                name="muscleMassLb"
                inputMode="decimal"
                value={values.muscleMassLb}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    muscleMassLb: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.muscleMassLb ? (
                <p className="text-xs text-ember">{state.fieldErrors.muscleMassLb}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
              Notes
              <textarea
                className={textAreaClassName()}
                name="notes"
                placeholder="Anything useful about hydration, timing, or context?"
                value={values.notes}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        <div className="flex justify-end">
          <AuthSubmitButton
            idleLabel={mode === "edit" ? "Save body metrics" : "Save measurement"}
            pendingLabel={mode === "edit" ? "Saving body metrics..." : "Saving measurement..."}
          />
        </div>
      </form>
    </section>
  );
}
