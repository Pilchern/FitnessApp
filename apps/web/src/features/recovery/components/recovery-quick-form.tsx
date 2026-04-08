"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { RecoveryCheckin } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { toRecoveryFormValues } from "../helpers";
import type { RecoveryActionState, RecoveryFormValues } from "../types";

type RecoveryQuickFormProps = {
  mode: "create" | "edit";
  checkin: RecoveryCheckin | null;
  action: (
    state: RecoveryActionState,
    formData: FormData,
  ) => Promise<RecoveryActionState>;
  formError?: string;
};

const initialState: RecoveryActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

const scoreOptions = Array.from({ length: 10 }, (_, index) => `${index + 1}`);
const sleepQualityOptions = ["1", "2", "3", "4", "5"];

export function RecoveryQuickForm({
  mode,
  checkin,
  action,
  formError,
}: RecoveryQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<RecoveryFormValues>(() =>
    toRecoveryFormValues(checkin),
  );
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");

  useEffect(() => {
    setValues(toRecoveryFormValues(checkin));
    setShowAdvanced(mode === "edit");
  }, [checkin, mode]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Quick add
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit"
              ? "Edit recovery check-in"
              : "Log recovery in under 20 seconds"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Log the basics in under a minute. Heart rate and HRV are optional.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/recovery"
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              name="checkinDate"
              type="date"
              value={values.checkinDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  checkinDate: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.checkinDate ? (
              <p className="text-xs text-ember">{state.fieldErrors.checkinDate}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Sleep hours
            <input
              className={fieldClassName()}
              name="sleepHours"
              inputMode="decimal"
              placeholder="7.5"
              value={values.sleepHours}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sleepHours: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.sleepHours ? (
              <p className="text-xs text-ember">{state.fieldErrors.sleepHours}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Alcohol count
            <input
              className={fieldClassName()}
              name="alcoholCount"
              inputMode="numeric"
              value={values.alcoholCount}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  alcoholCount: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.alcoholCount ? (
              <p className="text-xs text-ember">{state.fieldErrors.alcoholCount}</p>
            ) : null}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Sleep quality
            <select
              className={fieldClassName()}
              name="sleepQuality"
              value={values.sleepQuality}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sleepQuality: event.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {sleepQualityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
            {state.fieldErrors?.sleepQuality ? (
              <p className="text-xs text-ember">{state.fieldErrors.sleepQuality}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Readiness
            <select
              className={fieldClassName()}
              name="readinessLevel"
              value={values.readinessLevel}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  readinessLevel: event.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {scoreOptions.map((value) => (
                <option key={value} value={value}>
                  {value}/10
                </option>
              ))}
            </select>
            {state.fieldErrors?.readinessLevel ? (
              <p className="text-xs text-ember">{state.fieldErrors.readinessLevel}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Energy
            <select
              className={fieldClassName()}
              name="energyLevel"
              value={values.energyLevel}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  energyLevel: event.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {scoreOptions.map((value) => (
                <option key={value} value={value}>
                  {value}/10
                </option>
              ))}
            </select>
            {state.fieldErrors?.energyLevel ? (
              <p className="text-xs text-ember">{state.fieldErrors.energyLevel}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Stress
            <select
              className={fieldClassName()}
              name="stressLevel"
              value={values.stressLevel}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  stressLevel: event.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {scoreOptions.map((value) => (
                <option key={value} value={value}>
                  {value}/10
                </option>
              ))}
            </select>
            {state.fieldErrors?.stressLevel ? (
              <p className="text-xs text-ember">{state.fieldErrors.stressLevel}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Soreness
            <select
              className={fieldClassName()}
              name="sorenessLevel"
              value={values.sorenessLevel}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sorenessLevel: event.target.value,
                }))
              }
            >
              <option value="">Select</option>
              {scoreOptions.map((value) => (
                <option key={value} value={value}>
                  {value}/10
                </option>
              ))}
            </select>
            {state.fieldErrors?.sorenessLevel ? (
              <p className="text-xs text-ember">{state.fieldErrors.sorenessLevel}</p>
            ) : null}
          </label>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showAdvanced ? "Hide optional metrics" : "Add optional recovery metrics"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Resting HR
              <input
                className={fieldClassName()}
                name="restingHeartRate"
                inputMode="numeric"
                value={values.restingHeartRate}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    restingHeartRate: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.restingHeartRate ? (
                <p className="text-xs text-ember">{state.fieldErrors.restingHeartRate}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              HRV
              <input
                className={fieldClassName()}
                name="hrv"
                inputMode="decimal"
                value={values.hrv}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    hrv: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.hrv ? (
                <p className="text-xs text-ember">{state.fieldErrors.hrv}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
              Notes
              <textarea
                className={textAreaClassName()}
                name="notes"
                placeholder="Anything that explains the day?"
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
            idleLabel={mode === "edit" ? "Save recovery check-in" : "Save check-in"}
            pendingLabel={mode === "edit" ? "Saving recovery..." : "Saving check-in..."}
          />
        </div>
      </form>
    </section>
  );
}
