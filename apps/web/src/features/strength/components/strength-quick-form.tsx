"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { StrengthSession } from "@fitness-app/domain";
import type { StrengthTrainingTemplateDefinition } from "@fitness-app/application";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import {
  createEmptyStrengthSet,
  formatStrengthDate,
  toStrengthFormValues,
} from "../helpers";
import type {
  StrengthActionState,
  StrengthFormValues,
  StrengthSetFormValue,
} from "../types";

type StrengthQuickFormProps = {
  mode: "create" | "edit";
  session: StrengthSession | null;
  action: (
    state: StrengthActionState,
    formData: FormData,
  ) => Promise<StrengthActionState>;
  formError?: string;
  knownExercises: string[];
  lastSession: StrengthSession | null;
  loadedTemplate?: StrengthTrainingTemplateDefinition | null;
};

const initialState: StrengthActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function setField(
  sets: StrengthSetFormValue[],
  index: number,
  next: Partial<StrengthSetFormValue>,
) {
  return sets.map((set, currentIndex) =>
    currentIndex === index ? { ...set, ...next } : set,
  );
}

export function StrengthQuickForm({
  mode,
  session,
  action,
  formError,
  knownExercises,
  lastSession,
  loadedTemplate,
}: StrengthQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<StrengthFormValues>(() =>
    toStrengthFormValues(session),
  );
  const [showNotes, setShowNotes] = useState(mode === "edit");

  useEffect(() => {
    setValues(toStrengthFormValues(session));
    setShowNotes(mode === "edit");
  }, [mode, session]);

  useEffect(() => {
    if (loadedTemplate) {
      setValues((current) => ({
        ...current,
        sets: loadedTemplate.exercises.flatMap((ex) =>
          Array.from({ length: ex.targetSets }, (_, i) => ({
            exerciseName: ex.exerciseName,
            setNumber: i + 1,
            reps: ex.targetReps != null ? String(ex.targetReps) : "",
            weight: ex.targetWeight != null ? String(ex.targetWeight) : "",
            rir: ex.targetRir != null ? String(ex.targetRir) : "",
            notes: "",
          })),
        ),
      }));
    }
  }, [loadedTemplate]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Strength logging
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit" ? "Edit session" : "Log a lift quickly"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Fill in the session details, add your sets, and save.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/strength"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            Cancel edit
          </Link>
        ) : null}

        {mode === "create" && lastSession ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() =>
                setValues((current) => ({
                  sessionDate: current.sessionDate,
                  sessionName: lastSession.sessionName ?? "",
                  notes: "",
                  durationMinutes:
                    lastSession.durationMinutes != null
                      ? `${lastSession.durationMinutes}`
                      : "",
                  readinessPre: "",
                  energyPost: "",
                  completedAsPlanned: true,
                  sets:
                    lastSession.sets.length > 0
                      ? lastSession.sets.map((set) => ({
                          exerciseName: set.exerciseName,
                          setNumber: set.setNumber,
                          reps: set.reps != null ? `${set.reps}` : "",
                          weight: set.weight != null ? `${set.weight}` : "",
                          rir: set.rir != null ? `${set.rir}` : "",
                          notes: set.notes ?? "",
                        }))
                      : [createEmptyStrengthSet()],
                }))
              }
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Copy last session
            </button>
            <p className="text-xs text-ink/50">
              From:{" "}
              {lastSession.sessionName
                ? `${lastSession.sessionName} · `
                : ""}
              {formatStrengthDate(lastSession.sessionDate)}
            </p>
          </div>
        ) : null}
      </div>

      {formError || state.error ? (
        <div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {formError ?? state.error}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 space-y-5">
        <datalist id="strength-exercise-names">
          {knownExercises.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
        <input type="hidden" name="setsPayload" value={JSON.stringify(values.sets)} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              type="date"
              name="sessionDate"
              value={values.sessionDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sessionDate: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Session name
            <input
              className={fieldClassName()}
              name="sessionName"
              placeholder="Upper A"
              value={values.sessionName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sessionName: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Duration (min)
            <input
              className={fieldClassName()}
              inputMode="numeric"
              name="durationMinutes"
              value={values.durationMinutes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  durationMinutes: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Completed as planned
            <select
              className={fieldClassName()}
              name="completedAsPlanned"
              value={values.completedAsPlanned ? "true" : "false"}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  completedAsPlanned: event.target.value === "true",
                }))
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Readiness going in (1–10)
            <input
              className={fieldClassName()}
              inputMode="numeric"
              name="readinessPre"
              placeholder="7"
              value={values.readinessPre}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  readinessPre: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Energy after (1–10)
            <input
              className={fieldClassName()}
              inputMode="numeric"
              name="energyPost"
              placeholder="8"
              value={values.energyPost}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  energyPost: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Sets</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                setValues((current) => ({
                  ...current,
                  sets: [
                    ...current.sets,
                    createEmptyStrengthSet({ setNumber: current.sets.length + 1 }),
                  ],
                }))
              }
              className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Add set
            </button>
          </div>

          <div className="space-y-3">
            {values.sets.map((set, index) => (
              <div
                key={`${index}-${set.setNumber}`}
                className="grid gap-3 rounded-[1.5rem] border border-ink/10 bg-sand/45 p-4 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_auto]"
              >
                <input
                  className={fieldClassName()}
                  list="strength-exercise-names"
                  placeholder="Exercise name"
                  value={set.exerciseName}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        exerciseName: event.target.value,
                      }),
                    }))
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="numeric"
                  placeholder="Set"
                  value={set.setNumber}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        setNumber: Number(event.target.value || 1),
                      }),
                    }))
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="numeric"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        reps: event.target.value,
                      }),
                    }))
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="decimal"
                  placeholder="Weight"
                  value={set.weight}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        weight: event.target.value,
                      }),
                    }))
                  }
                />
                <input
                  className={fieldClassName()}
                  inputMode="decimal"
                  placeholder="RIR"
                  value={set.rir}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        rir: event.target.value,
                      }),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      sets:
                        current.sets.length > 1
                          ? current.sets.filter((_, currentIndex) => currentIndex !== index)
                          : current.sets,
                    }))
                  }
                  className="inline-flex h-11 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                >
                  Remove
                </button>

                <textarea
                  className={`${textAreaClassName()} md:col-span-6`}
                  placeholder="Optional set note"
                  value={set.notes}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      sets: setField(current.sets, index, {
                        notes: event.target.value,
                      }),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowNotes((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showNotes ? "Hide session notes" : "Add session notes"}
          </button>
        </div>

        {showNotes ? (
          <label className="grid gap-2 text-sm font-medium text-ink">
            Session notes
            <textarea
              className={textAreaClassName()}
              name="notes"
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

        <div className="flex justify-end">
          <AuthSubmitButton
            idleLabel={mode === "edit" ? "Save session" : "Save lift session"}
            pendingLabel={mode === "edit" ? "Saving session..." : "Saving lift..."}
          />
        </div>
      </form>
    </section>
  );
}
