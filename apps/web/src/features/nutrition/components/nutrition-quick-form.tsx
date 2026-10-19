"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { NutritionLog } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/shared/auth-submit-button";
import { toNutritionFormValues } from "../helpers";
import type { NutritionActionState, NutritionFormValues } from "../types";

type NutritionQuickFormProps = {
  mode: "create" | "edit";
  log: NutritionLog | null;
  action: (
    state: NutritionActionState,
    formData: FormData,
  ) => Promise<NutritionActionState>;
  formError?: string;
};

const initialState: NutritionActionState = {};

function fieldClassName() {
  // w-full + min-w-0: the default input width overflowed the two-column
  // Fuel grid on a phone.
  return "h-11 w-full min-w-0 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function checkboxClassName() {
  return "h-4 w-4 rounded border-ink/20 text-pine focus:ring-pine";
}

export function NutritionQuickForm({
  mode,
  log,
  action,
  formError,
}: NutritionQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<NutritionFormValues>(() =>
    toNutritionFormValues(log),
  );
  const [showNotes, setShowNotes] = useState(mode === "edit" && !!log?.notes);

  useEffect(() => {
    setValues(toNutritionFormValues(log));
    setShowNotes(mode === "edit" && !!log?.notes);
  }, [log, mode]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Quick add
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit" ? "Edit nutrition log" : "Log today's nutrition"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Check off each goal you hit today. Missed goals stay unchecked.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/nutrition"
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

        <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] border border-pine/20 bg-pine/5 p-4">
          <p className="col-span-2 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
            Fuel today
          </p>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            Protein (g)
            <input
              className={fieldClassName()}
              name="proteinGrams"
              inputMode="numeric"
              placeholder="180"
              value={values.proteinGrams}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  proteinGrams: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.proteinGrams ? (
              <p className="text-xs text-ember">
                {state.fieldErrors.proteinGrams}
              </p>
            ) : null}
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
            Calories (optional)
            <input
              className={fieldClassName()}
              name="calories"
              inputMode="numeric"
              value={values.calories}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  calories: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.calories ? (
              <p className="text-xs text-ember">{state.fieldErrors.calories}</p>
            ) : null}
          </label>
          <label className="col-span-2 flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="creatineTaken"
              checked={values.creatineTaken}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  creatineTaken: event.target.checked,
                }))
              }
            />
            Creatine taken
          </label>
          <label className="col-span-2 flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="protein50By9am"
              checked={values.protein50By9am}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  protein50By9am: event.target.checked,
                }))
              }
            />
            50 g protein by 9 AM
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              name="logDate"
              type="date"
              value={values.logDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  logDate: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.logDate ? (
              <p className="text-xs text-ember">{state.fieldErrors.logDate}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Alcohol count
            <input
              className={fieldClassName()}
              name="alcoholCount"
              inputMode="numeric"
              placeholder="0"
              value={values.alcoholCount}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  alcoholCount: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.alcoholCount ? (
              <p className="text-xs text-ember">
                {state.fieldErrors.alcoholCount}
              </p>
            ) : null}
          </label>
        </div>

        <div className="rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
            Daily checks
          </p>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="proteinHit"
              checked={values.proteinHit}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  proteinHit: event.target.checked,
                }))
              }
            />
            Protein hit
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="mealsOnPlan"
              checked={values.mealsOnPlan}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  mealsOnPlan: event.target.checked,
                }))
              }
            />
            Meals on plan
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="noPostDinnerSnacking"
              checked={values.noPostDinnerSnacking}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  noPostDinnerSnacking: event.target.checked,
                }))
              }
            />
            No post-dinner snacking
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="junkLeakage"
              checked={values.junkLeakage}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  junkLeakage: event.target.checked,
                }))
              }
            />
            Had junk food (leave unchecked if not)
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              className={checkboxClassName()}
              name="fiberTaken"
              checked={values.fiberTaken}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  fiberTaken: event.target.checked,
                }))
              }
            />
            Fiber taken
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowNotes((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showNotes ? "Hide notes" : "Add notes"}
          </button>
        </div>

        {showNotes ? (
          <label className="grid gap-2 text-sm font-medium text-ink">
            Notes
            <textarea
              className={textAreaClassName()}
              name="notes"
              placeholder="Anything worth noting about today's nutrition?"
              value={values.notes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </label>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-ink/65">
            Unchecked fields are saved as false. Only checked items count toward
            adherence.
          </p>
          <AuthSubmitButton
            idleLabel={mode === "edit" ? "Save nutrition log" : "Save log"}
            pendingLabel={
              mode === "edit" ? "Saving nutrition..." : "Saving log..."
            }
          />
        </div>
      </form>
    </section>
  );
}
