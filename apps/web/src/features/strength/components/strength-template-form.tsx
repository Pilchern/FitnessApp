"use client";

import { useActionState, useState } from "react";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { createStrengthTemplateAction } from "../actions";
import type { StrengthActionState } from "../types";

type TemplateExerciseRow = {
  exerciseName: string;
  targetSets: string;
  targetReps: string;
  targetWeight: string;
  targetRir: string;
  notes: string;
};

const initialState: StrengthActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function createEmptyExercise(): TemplateExerciseRow {
  return {
    exerciseName: "",
    targetSets: "",
    targetReps: "",
    targetWeight: "",
    targetRir: "",
    notes: "",
  };
}

function updateExercise(
  exercises: TemplateExerciseRow[],
  index: number,
  next: Partial<TemplateExerciseRow>,
): TemplateExerciseRow[] {
  return exercises.map((ex, i) => (i === index ? { ...ex, ...next } : ex));
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

type StrengthTemplateFormProps = {
  knownExercises?: string[];
};

export function StrengthTemplateForm({ knownExercises = [] }: StrengthTemplateFormProps) {
  const [state, formAction] = useActionState(createStrengthTemplateAction, initialState);
  const [exercises, setExercises] = useState<TemplateExerciseRow[]>([
    createEmptyExercise(),
  ]);
  const [templateName, setTemplateName] = useState("");

  function buildExercisesPayload() {
    return JSON.stringify(
      exercises.map((ex, index) => ({
        exerciseName: ex.exerciseName.trim(),
        exerciseOrder: index,
        targetSets: parseInt(ex.targetSets, 10) || 1,
        targetReps: parseOptionalInt(ex.targetReps),
        targetWeight: parseOptionalFloat(ex.targetWeight),
        targetRir: parseOptionalInt(ex.targetRir),
        notes: ex.notes.trim() || null,
      })),
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Workout templates
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">
          Create a template
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/75">
          Define your program once and load it when starting a new session.
        </p>
      </div>

      {state.error ? (
        <div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      <form
        action={(formData) => {
          formData.set("exercisesPayload", buildExercisesPayload());
          return formAction(formData);
        }}
        className="mt-5 space-y-5"
      >
        {knownExercises.length > 0 ? (
          <datalist id="template-exercise-names">
            {knownExercises.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-ink">
          Template name
          <input
            className={fieldClassName()}
            name="name"
            placeholder="Upper A, Pull Day, Leg Day…"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            required
          />
        </label>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-ink">Exercises</h3>
            <button
              type="button"
              onClick={() =>
                setExercises((current) => [...current, createEmptyExercise()])
              }
              className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Add exercise
            </button>
          </div>

          <div className="space-y-3">
            {exercises.map((ex, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-[1.5rem] border border-ink/10 bg-sand/45 p-4 md:grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr_0.6fr_auto]"
              >
                <input
                  className={fieldClassName()}
                  list={knownExercises.length > 0 ? "template-exercise-names" : undefined}
                  placeholder="Exercise name"
                  value={ex.exerciseName}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        exerciseName: e.target.value,
                      }),
                    )
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="numeric"
                  placeholder="Sets"
                  value={ex.targetSets}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        targetSets: e.target.value,
                      }),
                    )
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="numeric"
                  placeholder="Reps"
                  value={ex.targetReps}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        targetReps: e.target.value,
                      }),
                    )
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="decimal"
                  placeholder="Target weight (lb)"
                  value={ex.targetWeight}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        targetWeight: e.target.value,
                      }),
                    )
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="numeric"
                  placeholder="RIR"
                  value={ex.targetRir}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        targetRir: e.target.value,
                      }),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setExercises((current) =>
                      current.length > 1
                        ? current.filter((_, i) => i !== index)
                        : current,
                    )
                  }
                  className="inline-flex h-11 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                >
                  Remove
                </button>

                <textarea
                  className={`${textAreaClassName()} md:col-span-6`}
                  placeholder="Optional exercise note"
                  value={ex.notes}
                  onChange={(e) =>
                    setExercises((current) =>
                      updateExercise(current, index, {
                        notes: e.target.value,
                      }),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <AuthSubmitButton
            idleLabel="Save template"
            pendingLabel="Saving template..."
          />
        </div>
      </form>
    </section>
  );
}
