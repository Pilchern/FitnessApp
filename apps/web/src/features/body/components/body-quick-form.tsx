"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { BodyMetric } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/shared/auth-submit-button";
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
  const [values, setValues] = useState<BodyFormValues>(() =>
    toBodyFormValues(metric),
  );
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");
  useEffect(() => {
    const next = toBodyFormValues(metric);
    setValues(next);
    setShowAdvanced(mode === "edit");
  }, [metric, mode]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg text-ink">
            {mode === "edit" ? "Edit measurements" : "Log measurements"}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Waist at the navel; thighs 6 in above the kneecap.
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

        <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="text-xs text-ember">
                {state.fieldErrors.measuredOn}
              </p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Waist at navel (in)
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
          <label className="grid gap-2 text-sm font-medium text-ink">
            Left thigh (in)
            <input
              className={fieldClassName()}
              name="thighLIn"
              inputMode="decimal"
              placeholder="22.0"
              value={values.thighLIn}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  thighLIn: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.thighLIn ? (
              <p className="text-xs text-ember">{state.fieldErrors.thighLIn}</p>
            ) : null}
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Right thigh (in)
            <input
              className={fieldClassName()}
              name="thighRIn"
              inputMode="decimal"
              placeholder="23.0"
              value={values.thighRIn}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  thighRIn: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.thighRIn ? (
              <p className="text-xs text-ember">{state.fieldErrors.thighRIn}</p>
            ) : null}
          </label>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="min-h-10 text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showAdvanced
              ? "Hide optional fields"
              : "Add hip/gut waist or notes"}
          </button>
          <Link
            href="/body/dexa"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            DEXA scans
          </Link>
        </div>

        {showAdvanced ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Waist at hip (in)
              <input
                className={fieldClassName()}
                name="waistHipIn"
                inputMode="decimal"
                placeholder="38.5"
                value={values.waistHipIn}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    waistHipIn: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.waistHipIn ? (
                <p className="text-xs text-ember">
                  {state.fieldErrors.waistHipIn}
                </p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Waist at gut (in)
              <input
                className={fieldClassName()}
                name="waistGutIn"
                inputMode="decimal"
                placeholder="36.2"
                value={values.waistGutIn}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    waistGutIn: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.waistGutIn ? (
                <p className="text-xs text-ember">
                  {state.fieldErrors.waistGutIn}
                </p>
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
            idleLabel={
              mode === "edit" ? "Save measurements" : "Save measurement"
            }
            pendingLabel={
              mode === "edit"
                ? "Saving measurements..."
                : "Saving measurement..."
            }
          />
        </div>
      </form>
    </section>
  );
}
