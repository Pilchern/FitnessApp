"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { StrengthSession } from "@fitness-app/domain";
import type { StrengthTrainingTemplateDefinition } from "@fitness-app/application";
import {
  createEmptyStrengthSet,
  exerciseKey,
  formatLastPerformance,
  formatStrengthDate,
  groupSetsByExercise,
  isTimedSet,
  renumberSets,
  selectSetsToSave,
  startingDuration,
  startingWeight,
  toStrengthFormValues,
  type LastExercisePerformance,
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
  loadedTemplateName?: string | null;
  lastByExercise?: Record<string, LastExercisePerformance>;
};

const initialState: StrengthActionState = {};
const REST_OPTIONS = [60, 90, 120, 180];

function fieldClassName() {
  return "h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
}

function toDoneSets(sets: StrengthSetFormValue[]) {
  return sets.map((set) => ({ ...set, done: true }));
}

function Stepper({
  value,
  onChange,
  step,
  label,
  decimal,
}: {
  value: string;
  onChange: (next: string) => void;
  step: number;
  label: string;
  decimal?: boolean;
}) {
  function bump(direction: 1 | -1) {
    const current = Number(value) || 0;
    const next = Math.max(
      0,
      Math.round((current + direction * step) * 100) / 100,
    );
    onChange(`${next}`);
  }

  return (
    <div className="flex h-12 min-w-0 items-stretch overflow-hidden rounded-2xl border border-ink/10 bg-white">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => bump(-1)}
        className="w-9 shrink-0 text-xl font-semibold text-ink/70 active:bg-pine/10"
      >
        −
      </button>
      <input
        className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold text-ink outline-none"
        inputMode={decimal ? "decimal" : "numeric"}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => bump(1)}
        className="w-9 shrink-0 text-xl font-semibold text-ink/70 active:bg-pine/10"
      >
        +
      </button>
    </div>
  );
}

function SaveButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 w-full rounded-2xl bg-pine text-base font-semibold text-white shadow-panel transition active:bg-pine/90 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
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
  loadedTemplateName,
  lastByExercise = {},
}: StrengthQuickFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<StrengthFormValues>(() => {
    const initial = toStrengthFormValues(session);
    return mode === "edit"
      ? { ...initial, sets: toDoneSets(initial.sets) }
      : initial;
  });
  const [showDetails, setShowDetails] = useState(mode === "edit");
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(
    {},
  );
  const [planNotes, setPlanNotes] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState("");
  const [restSeconds, setRestSeconds] = useState(90);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const vibrated = useRef(false);

  useEffect(() => {
    const initial = toStrengthFormValues(session);
    setValues(
      mode === "edit"
        ? { ...initial, sets: toDoneSets(initial.sets) }
        : initial,
    );
    setShowDetails(mode === "edit");
  }, [mode, session]);

  useEffect(() => {
    if (!loadedTemplate) return;
    setPlanNotes(loadedTemplate.notes ?? null);
    setExerciseNotes(
      Object.fromEntries(
        loadedTemplate.exercises
          .filter((ex) => ex.notes)
          .map((ex) => [exerciseKey(ex.exerciseName), ex.notes as string]),
      ),
    );
    setValues((current) => ({
      ...current,
      sessionName: loadedTemplateName ?? current.sessionName,
      sets: loadedTemplate.exercises.flatMap((ex) =>
        Array.from({ length: ex.targetSets }, (_, i) => ({
          exerciseName: ex.exerciseName,
          setNumber: i + 1,
          reps: ex.targetReps != null ? String(ex.targetReps) : "",
          weight: startingWeight(
            lastByExercise[exerciseKey(ex.exerciseName)],
            i,
            ex.targetWeight,
          ),
          rir: ex.targetRir != null ? String(ex.targetRir) : "",
          isWarmup: false,
          durationSeconds: startingDuration(
            lastByExercise[exerciseKey(ex.exerciseName)],
            i,
          ),
          distanceMeters: "",
          notes: "",
          done: false,
        })),
      ),
    }));
    // Only re-run when a plan is loaded; lastByExercise is stable page data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedTemplate]);

  useEffect(() => {
    if (restEndsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [restEndsAt]);

  const restRemaining =
    restEndsAt == null ? 0 : Math.max(0, Math.ceil((restEndsAt - now) / 1000));

  useEffect(() => {
    if (restEndsAt != null && restRemaining === 0 && !vibrated.current) {
      vibrated.current = true;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // Vibration is a nicety; ignore unsupported browsers.
      }
    }
  }, [restEndsAt, restRemaining]);

  function startRest() {
    vibrated.current = false;
    setNow(Date.now());
    setRestEndsAt(Date.now() + restSeconds * 1000);
  }

  function updateSet(index: number, next: Partial<StrengthSetFormValue>) {
    setValues((current) => ({
      ...current,
      sets: current.sets.map((set, i) =>
        i === index ? { ...set, ...next } : set,
      ),
    }));
  }

  function toggleDone(index: number) {
    const wasDone = Boolean(values.sets[index]?.done);
    updateSet(index, { done: !wasDone });
    if (!wasDone) startRest();
  }

  function addSet(groupIndexes: number[]) {
    const lastIndex = groupIndexes[groupIndexes.length - 1] ?? 0;
    const source = values.sets[lastIndex];
    if (!source) return;
    setValues((current) => {
      const copy = createEmptyStrengthSet({
        exerciseName: source.exerciseName,
        reps: source.reps,
        weight: source.weight,
        rir: source.rir,
        durationSeconds: source.durationSeconds,
      });
      const sets = [...current.sets];
      sets.splice(lastIndex + 1, 0, { ...copy, done: false });
      return { ...current, sets: renumberSets(sets) };
    });
  }

  function removeSet(index: number) {
    setValues((current) =>
      current.sets.length > 1
        ? {
            ...current,
            sets: renumberSets(current.sets.filter((_, i) => i !== index)),
          }
        : current,
    );
  }

  function removeExercise(indexes: number[]) {
    setValues((current) => {
      const remaining = current.sets.filter((_, i) => !indexes.includes(i));
      return {
        ...current,
        sets: remaining.length > 0 ? remaining : [createEmptyStrengthSet()],
      };
    });
  }

  function addExercise() {
    const name = newExercise.trim();
    if (!name) return;
    const last = lastByExercise[exerciseKey(name)];
    setValues((current) => {
      const hasOnlyBlank =
        current.sets.length === 1 && !current.sets[0]?.exerciseName.trim();
      const fresh = {
        ...createEmptyStrengthSet({
          exerciseName: name,
          weight: startingWeight(last, 0, null),
          durationSeconds: startingDuration(last, 0),
        }),
        done: false,
      };
      return {
        ...current,
        sets: hasOnlyBlank ? [fresh] : [...current.sets, fresh],
      };
    });
    setNewExercise("");
  }

  function setRirForGroup(indexes: number[], rir: string) {
    setValues((current) => ({
      ...current,
      sets: current.sets.map((set, i) =>
        indexes.includes(i) ? { ...set, rir } : set,
      ),
    }));
  }

  function copyLastSession() {
    if (!lastSession) return;
    setValues((current) => ({
      ...current,
      sessionName: lastSession.sessionName ?? "",
      durationMinutes:
        lastSession.durationMinutes != null
          ? `${lastSession.durationMinutes}`
          : "",
      sets:
        lastSession.sets.length > 0
          ? lastSession.sets.map((set) => ({
              exerciseName: set.exerciseName,
              setNumber: set.setNumber,
              reps: set.reps != null ? `${set.reps}` : "",
              weight: set.weight != null ? `${set.weight}` : "",
              rir: set.rir != null ? `${set.rir}` : "",
              isWarmup: false,
              durationSeconds:
                set.durationSeconds != null ? `${set.durationSeconds}` : "",
              distanceMeters:
                set.distanceMeters != null ? `${set.distanceMeters}` : "",
              notes: set.notes ?? "",
              done: false,
            }))
          : [createEmptyStrengthSet()],
    }));
  }

  const groups = groupSetsByExercise(values.sets);
  const hasNamedSets = values.sets.some((set) => set.exerciseName.trim());
  const doneCount = values.sets.filter((set) => set.done).length;
  const savedSets = selectSetsToSave(values.sets);
  const payload = renumberSets(
    savedSets.map((set) => {
      const rest = { ...set };
      delete rest.done;
      return rest;
    }),
  );
  const saveLabel =
    mode === "edit"
      ? "Save session"
      : doneCount > 0
        ? `Finish workout · ${doneCount} of ${values.sets.length} sets`
        : "Save workout";

  return (
    <section className="space-y-4 pb-40">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            {mode === "edit" ? "Edit session" : "Workout"}
          </p>
          {/* The server renders in UTC; after 7 PM Central the client's date
              is a day behind, which is correct, so skip the mismatch error. */}
          <h2
            suppressHydrationWarning
            className="truncate font-display text-xl text-ink"
          >
            {values.sessionName || formatStrengthDate(values.sessionDate)}
          </h2>
        </div>
        {mode === "edit" ? (
          <Link
            href="/strength"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink"
          >
            Cancel
          </Link>
        ) : lastSession ? (
          <button
            type="button"
            onClick={copyLastSession}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink"
          >
            Copy last
          </button>
        ) : null}
      </div>

      {planNotes ? (
        <details className="rounded-2xl border border-ember/25 bg-ember/5 px-4 py-3 text-sm text-ink">
          <summary className="cursor-pointer font-semibold text-ember">
            Plan rules
          </summary>
          <p className="mt-2 leading-6 text-ink/80">{planNotes}</p>
        </details>
      ) : null}

      {formError || state.error ? (
        <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {formError ?? state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <datalist id="strength-exercise-names">
          {knownExercises.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
        <input
          type="hidden"
          name="setsPayload"
          value={JSON.stringify(payload)}
        />
        <input type="hidden" name="sessionDate" value={values.sessionDate} />
        <input type="hidden" name="sessionName" value={values.sessionName} />
        <input
          type="hidden"
          name="durationMinutes"
          value={values.durationMinutes}
        />
        <input type="hidden" name="readinessPre" value={values.readinessPre} />
        <input type="hidden" name="energyPost" value={values.energyPost} />
        <input
          type="hidden"
          name="completedAsPlanned"
          value={values.completedAsPlanned ? "true" : "false"}
        />
        <input type="hidden" name="notes" value={values.notes} />

        {!hasNamedSets ? (
          <p className="rounded-2xl border border-ink/10 bg-sand/45 px-4 py-6 text-center text-sm text-ink/70">
            Load a plan above, copy your last session, or add an exercise below.
          </p>
        ) : null}

        {groups.map((group) => {
          const first = values.sets[group.indexes[0] ?? 0];
          if (!first || !group.name.trim()) return null;
          const last = lastByExercise[group.key];
          const timed = isTimedSet(first);
          const groupDone = group.indexes.filter(
            (i) => values.sets[i]?.done,
          ).length;

          return (
            <div
              key={`${group.key}-${group.indexes[0]}`}
              className="rounded-[1.5rem] border border-ink/10 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">
                    {group.name}
                  </h3>
                  {exerciseNotes[group.key] ? (
                    <p className="mt-0.5 text-xs font-medium text-ember">
                      {exerciseNotes[group.key]}
                    </p>
                  ) : null}
                  {last ? (
                    <p className="mt-0.5 text-xs text-ink/60">
                      Last ({formatStrengthDate(last.sessionDate)}):{" "}
                      {formatLastPerformance(last)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold text-pine">
                    {groupDone}/{group.indexes.length}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${group.name}`}
                    onClick={() => removeExercise(group.indexes)}
                    className="h-9 w-9 rounded-full text-lg text-ember active:bg-ember/10"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {group.indexes.map((index) => {
                  const set = values.sets[index];
                  if (!set) return null;
                  return (
                    <div
                      key={index}
                      className={`grid items-center gap-1.5 rounded-2xl p-1 ${
                        timed
                          ? "grid-cols-[1.75rem_1fr_3rem]"
                          : "grid-cols-[1.75rem_1fr_1fr_3rem]"
                      } ${set.done ? "bg-pine/10" : ""}`}
                    >
                      <button
                        type="button"
                        aria-label={`Set ${set.setNumber}: tap to toggle warm-up`}
                        onClick={() =>
                          updateSet(index, { isWarmup: !set.isWarmup })
                        }
                        className={`h-12 text-sm font-semibold ${
                          set.isWarmup ? "text-ember" : "text-ink/60"
                        }`}
                      >
                        {set.isWarmup ? "W" : set.setNumber}
                      </button>
                      {timed ? (
                        <Stepper
                          label={`Seconds for set ${set.setNumber}`}
                          value={set.durationSeconds}
                          step={5}
                          onChange={(next) =>
                            updateSet(index, { durationSeconds: next })
                          }
                        />
                      ) : (
                        <>
                          <Stepper
                            decimal
                            label={`Weight for set ${set.setNumber}`}
                            value={set.weight}
                            step={Number(set.weight) >= 45 ? 5 : 2.5}
                            onChange={(next) =>
                              updateSet(index, { weight: next })
                            }
                          />
                          <Stepper
                            label={`Reps for set ${set.setNumber}`}
                            value={set.reps}
                            step={1}
                            onChange={(next) =>
                              updateSet(index, { reps: next })
                            }
                          />
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={`Mark set ${set.setNumber} ${set.done ? "not done" : "done"}`}
                        aria-pressed={Boolean(set.done)}
                        onClick={() => toggleDone(index)}
                        className={`h-12 rounded-2xl text-xl font-semibold transition ${
                          set.done
                            ? "bg-pine text-white"
                            : "border border-ink/15 bg-white text-ink/40"
                        }`}
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addSet(group.indexes)}
                    className="h-10 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink active:bg-pine/10"
                  >
                    + Set
                  </button>
                  {group.indexes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        removeSet(group.indexes[group.indexes.length - 1] ?? 0)
                      }
                      className="h-10 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink/70 active:bg-ember/10"
                    >
                      − Set
                    </button>
                  ) : null}
                </div>
                {timed ? null : (
                  <label className="flex items-center gap-2 text-xs font-medium text-ink/70">
                    RIR
                    <input
                      className="h-10 w-14 rounded-xl border border-ink/10 bg-white text-center text-base text-ink"
                      inputMode="decimal"
                      aria-label={`Reps in reserve for ${group.name}`}
                      value={first.rir}
                      onChange={(event) =>
                        setRirForGroup(group.indexes, event.target.value)
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2">
          <input
            className={`${fieldClassName()} min-w-0 flex-1`}
            list="strength-exercise-names"
            placeholder="Add exercise"
            aria-label="Add exercise"
            value={newExercise}
            onChange={(event) => setNewExercise(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addExercise();
              }
            }}
          />
          <button
            type="button"
            onClick={addExercise}
            className="h-12 shrink-0 rounded-2xl border border-ink/15 bg-white px-5 text-sm font-semibold text-ink active:bg-pine/10"
          >
            Add
          </button>
        </div>

        <div className="rounded-[1.5rem] border border-ink/10 bg-white/80">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
            className="flex h-12 w-full items-center justify-between px-4 text-sm font-semibold text-ink"
          >
            Session details
            <span className="text-ink/50">{showDetails ? "−" : "+"}</span>
          </button>
          {showDetails ? (
            <div className="grid gap-3 border-t border-ink/10 p-4">
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Date
                <input
                  className={fieldClassName()}
                  type="date"
                  value={values.sessionDate}
                  onChange={(event) =>
                    setValues((c) => ({
                      ...c,
                      sessionDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Session name
                <input
                  className={fieldClassName()}
                  placeholder="Tue Push"
                  value={values.sessionName}
                  onChange={(event) =>
                    setValues((c) => ({
                      ...c,
                      sessionName: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Minutes
                  <input
                    className={fieldClassName()}
                    inputMode="numeric"
                    value={values.durationMinutes}
                    onChange={(event) =>
                      setValues((c) => ({
                        ...c,
                        durationMinutes: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Readiness
                  <input
                    className={fieldClassName()}
                    inputMode="numeric"
                    placeholder="1-10"
                    value={values.readinessPre}
                    onChange={(event) =>
                      setValues((c) => ({
                        ...c,
                        readinessPre: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Energy
                  <input
                    className={fieldClassName()}
                    inputMode="numeric"
                    placeholder="1-10"
                    value={values.energyPost}
                    onChange={(event) =>
                      setValues((c) => ({
                        ...c,
                        energyPost: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="flex h-12 items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-ink/20 text-pine"
                  checked={values.completedAsPlanned}
                  onChange={(event) =>
                    setValues((c) => ({
                      ...c,
                      completedAsPlanned: event.target.checked,
                    }))
                  }
                />
                Completed as planned
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Notes (knee pain /10, swelling, anything off)
                <textarea
                  className="min-h-24 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base text-ink outline-none focus:border-pine"
                  value={values.notes}
                  onChange={(event) =>
                    setValues((c) => ({ ...c, notes: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 space-y-2 border-t border-ink/10 bg-white/95 px-3 pb-3 pt-2 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
          {restEndsAt != null && mode === "create" ? (
            <div className="flex h-12 items-center justify-between gap-2 rounded-2xl bg-ink px-3 text-white">
              <span className="text-lg font-semibold tabular-nums">
                {restRemaining > 0
                  ? `Rest ${formatClock(restRemaining)}`
                  : "Rest over, go"}
              </span>
              <div className="flex items-center gap-1">
                {REST_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setRestSeconds(option);
                      vibrated.current = false;
                      setNow(Date.now());
                      setRestEndsAt(Date.now() + option * 1000);
                    }}
                    className={`h-9 rounded-full px-2.5 text-xs font-semibold ${
                      restSeconds === option
                        ? "bg-white text-ink"
                        : "text-white/70"
                    }`}
                  >
                    {option >= 120 ? `${option / 60}m` : `${option}s`}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Dismiss rest timer"
                  onClick={() => setRestEndsAt(null)}
                  className="h-9 w-9 text-lg text-white/70"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}
          <SaveButton label={saveLabel} pendingLabel="Saving..." />
        </div>
      </form>
    </section>
  );
}
