"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { CardioSession } from "@fitness-app/domain";
import type { CardioActionState, CardioFormValues, CardioTemplatePreset } from "../types";
import { toCardioFormValues } from "../helpers";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

type CardioQuickFormProps = {
  mode: "create" | "edit";
  templates: CardioTemplatePreset[];
  session: CardioSession | null;
  action: (
    state: CardioActionState,
    formData: FormData,
  ) => Promise<CardioActionState>;
  formError?: string;
};

const initialState: CardioActionState = {};

const statusOptions = [
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "planned", label: "Planned" },
  { value: "skipped", label: "Skipped" },
] as const;

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function applyTemplateToValues(
  current: CardioFormValues,
  template: CardioTemplatePreset,
): CardioFormValues {
  return {
    ...current,
    trainingTemplateId: template.id,
    sessionKind: template.sessionKind,
    durationMinutes:
      template.targetDurationMinutes != null
        ? `${template.targetDurationMinutes}`
        : current.durationMinutes,
    intervalStructure: template.intervalStructure ?? current.intervalStructure,
  };
}

export function CardioQuickForm({
  mode,
  templates,
  session,
  action,
  formError,
}: CardioQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState(() => toCardioFormValues(session));
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");

  useEffect(() => {
    setValues(toCardioFormValues(session));
    setShowAdvanced(mode === "edit");
  }, [mode, session]);

  const selectedTemplateId = values.trainingTemplateId;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Quick add
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit" ? "Edit workout" : "Log a workout in under 30 seconds"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Start with a template, confirm the basics, and expand details only
            when you need them.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/cardio"
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
        <input
          type="hidden"
          name="trainingTemplateId"
          value={values.trainingTemplateId}
        />

        <div className="space-y-3">
          <div className="text-sm font-semibold text-ink">Templates</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() =>
                    setValues((current) => applyTemplateToValues(current, template))
                  }
                  className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-pine/35 bg-pine text-white"
                      : "border-ink/10 bg-white hover:border-pine/30 hover:bg-pine/5"
                  }`}
                >
                  <div className="text-sm font-semibold">{template.name}</div>
                  <div
                    className={`mt-1 text-xs leading-5 ${
                      isSelected ? "text-white/80" : "text-ink/65"
                    }`}
                  >
                    {template.targetDurationMinutes
                      ? `${template.targetDurationMinutes} min default`
                      : "Flexible duration"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              name="sessionDate"
              type="date"
              value={values.sessionDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sessionDate: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.sessionDate ? (
              <p className="text-xs text-ember">{state.fieldErrors.sessionDate}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Session type
            <select
              className={fieldClassName()}
              name="sessionKind"
              value={values.sessionKind}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sessionKind: event.target.value as CardioSession["sessionKind"],
                }))
              }
            >
              <option value="zone2">Zone 2</option>
              <option value="vo2">VO2</option>
              <option value="recovery">Recovery</option>
              <option value="other">Other</option>
            </select>
            {state.fieldErrors?.sessionKind ? (
              <p className="text-xs text-ember">{state.fieldErrors.sessionKind}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Duration (min)
            <input
              className={fieldClassName()}
              name="durationMinutes"
              inputMode="numeric"
              placeholder="45"
              value={values.durationMinutes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  durationMinutes: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.durationMinutes ? (
              <p className="text-xs text-ember">{state.fieldErrors.durationMinutes}</p>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Avg HR
            <input
              className={fieldClassName()}
              name="avgHeartRate"
              inputMode="numeric"
              placeholder="135"
              value={values.avgHeartRate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  avgHeartRate: event.target.value,
                }))
              }
            />
            {state.fieldErrors?.avgHeartRate ? (
              <p className="text-xs text-ember">{state.fieldErrors.avgHeartRate}</p>
            ) : null}
          </label>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-ink">Plan status</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusOptions.map((option) => {
              const isSelected = values.plannedVsCompleted === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-full border px-4 py-3 text-center text-sm font-semibold transition ${
                    isSelected
                      ? "border-pine/35 bg-pine text-white"
                      : "border-ink/10 bg-white text-ink hover:border-pine/30 hover:bg-pine/5"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="plannedVsCompleted"
                    value={option.value}
                    checked={isSelected}
                    onChange={() =>
                      setValues((current) => ({
                        ...current,
                        plannedVsCompleted: option.value,
                      }))
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showAdvanced ? "Hide advanced fields" : "More details"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Max HR
              <input
                className={fieldClassName()}
                name="maxHeartRate"
                inputMode="numeric"
                value={values.maxHeartRate}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    maxHeartRate: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.maxHeartRate ? (
                <p className="text-xs text-ember">{state.fieldErrors.maxHeartRate}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Avg output
              <input
                className={fieldClassName()}
                name="avgOutput"
                inputMode="decimal"
                value={values.avgOutput}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    avgOutput: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.avgOutput ? (
                <p className="text-xs text-ember">{state.fieldErrors.avgOutput}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              RPE
              <input
                className={fieldClassName()}
                name="rpe"
                inputMode="decimal"
                value={values.rpe}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    rpe: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.rpe ? (
                <p className="text-xs text-ember">{state.fieldErrors.rpe}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Cadence min
              <input
                className={fieldClassName()}
                name="cadenceMin"
                inputMode="numeric"
                value={values.cadenceMin}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cadenceMin: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.cadenceMin ? (
                <p className="text-xs text-ember">{state.fieldErrors.cadenceMin}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Cadence max
              <input
                className={fieldClassName()}
                name="cadenceMax"
                inputMode="numeric"
                value={values.cadenceMax}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    cadenceMax: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.cadenceMax ? (
                <p className="text-xs text-ember">{state.fieldErrors.cadenceMax}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Resistance min
              <input
                className={fieldClassName()}
                name="resistanceMin"
                inputMode="decimal"
                value={values.resistanceMin}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    resistanceMin: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.resistanceMin ? (
                <p className="text-xs text-ember">{state.fieldErrors.resistanceMin}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Resistance max
              <input
                className={fieldClassName()}
                name="resistanceMax"
                inputMode="decimal"
                value={values.resistanceMax}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    resistanceMax: event.target.value,
                  }))
                }
              />
              {state.fieldErrors?.resistanceMax ? (
                <p className="text-xs text-ember">{state.fieldErrors.resistanceMax}</p>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2 xl:col-span-3">
              Interval structure
              <input
                className={fieldClassName()}
                name="intervalStructure"
                placeholder="4 x 4 min work / 3 min recovery"
                value={values.intervalStructure}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    intervalStructure: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2 xl:col-span-3">
              Notes
              <textarea
                className={textAreaClassName()}
                name="notes"
                placeholder="Anything worth remembering about this workout?"
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

        <AuthSubmitButton
          idleLabel={mode === "edit" ? "Save workout" : "Log workout"}
          pendingLabel={mode === "edit" ? "Saving..." : "Logging..."}
        />
      </form>
    </section>
  );
}
