"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { StrengthSession } from "@fitness-app/domain";
import {
  restForTick,
  restMetaFromPlan,
  type LoggerPlanExercise,
  type RestMeta,
} from "@fitness-app/application";
import { useBeep, useScreenWakeLock } from "@/lib/client/timer-cues";
import {
  createEmptyStrengthSet,
  draftWasSaved,
  exerciseKey,
  formatLastPerformance,
  formatStrengthDate,
  groupSetsByExercise,
  isForceSet,
  isTimedSet,
  parseStrengthDraft,
  planExerciseSets,
  readyToAddLoad,
  showsTimedWeight,
  renumberSets,
  selectSetsToSave,
  setLabel,
  startingDuration,
  startingWeight,
  STRENGTH_DRAFT_KEY,
  templateRepTop,
  toStrengthFormValues,
  withRightRepsFromLeft,
  type LastExercisePerformance,
  type StrengthDraft,
} from "../helpers";
import {
  restBeepFresh,
  restEndDue,
  restRunning,
  restSecondsLeft,
} from "../rest-timer";
import type {
  StrengthActionState,
  StrengthFormValues,
  StrengthSetFormValue,
} from "../types";

/** A plan the user asked to load; a new `id` per tap. */
export type PlanRequest = {
  id: number;
  name: string;
  /** A template, or today's program lift (legs with per-leg and isometric work). */
  definition: { notes?: string | null; exercises: LoggerPlanExercise[] };
  /** Today's program session, when the program's Start loaded it. */
  programSessionId?: string | null;
};

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
  planRequest?: PlanRequest | null;
  lastByExercise?: Record<string, LastExercisePerformance>;
  latestCreatedAt?: string | null;
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

function readDraft(): StrengthDraft | null {
  try {
    return parseStrengthDraft(
      window.localStorage.getItem(STRENGTH_DRAFT_KEY),
      Date.now(),
    );
  } catch {
    return null;
  }
}

function writeDraft(draft: StrengthDraft | null) {
  try {
    if (draft) {
      window.localStorage.setItem(STRENGTH_DRAFT_KEY, JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(STRENGTH_DRAFT_KEY);
    }
  } catch {
    // Private mode or full storage: the workout still saves, it just will not
    // survive a reload.
  }
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
        className="w-11 shrink-0 text-xl font-semibold text-ink/70 active:bg-pine/10"
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
        className="w-11 shrink-0 text-xl font-semibold text-ink/70 active:bg-pine/10"
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
  planRequest = null,
  lastByExercise = {},
  latestCreatedAt = null,
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
  const [repTops, setRepTops] = useState<Record<string, number>>({});
  const [newExercise, setNewExercise] = useState("");
  const [restSeconds, setRestSeconds] = useState(90);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  /** Program rest rules by exercise key; empty for templates and free logging. */
  const [restMeta, setRestMeta] = useState<RestMeta>({});
  /** What comes next: "Right leg", "Next: A2 Pull-Up", "Then A1 Squat". */
  const [nextCue, setNextCue] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** The "rest over" beep and buzz has fired for the current rest. */
  const restCued = useRef(false);
  const { unlock: unlockAudio, beep } = useBeep();
  const draftChecked = useRef(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  // A plan requested before this form mounted (e.g. before Edit -> Cancel)
  // was already handled; only later requests load.
  const handledPlanId = useRef(planRequest?.id ?? null);

  useEffect(() => {
    const initial = toStrengthFormValues(session);
    setValues(
      mode === "edit"
        ? { ...initial, sets: toDoneSets(initial.sets) }
        : initial,
    );
    setShowDetails(mode === "edit");
  }, [mode, session]);

  /** Ticked sets or a restored draft are real work; ask before replacing them. */
  function confirmReplace(label: string) {
    const hasWork = values.sets.some((set) => set.done) || restoredAt != null;
    return (
      !hasWork || window.confirm(`Replace the current workout with ${label}?`)
    );
  }

  useEffect(() => {
    if (!planRequest || planRequest.id === handledPlanId.current) return;
    handledPlanId.current = planRequest.id;
    if (mode !== "create" || !confirmReplace(planRequest.name)) return;

    const plan = planRequest.definition;
    setRestoredAt(null);
    setPlanNotes(plan.notes ?? null);
    setRestMeta(restMetaFromPlan(plan.exercises));
    setNextCue(null);
    setExerciseNotes(
      Object.fromEntries(
        plan.exercises
          .filter((ex) => ex.notes)
          .map((ex) => [exerciseKey(ex.exerciseName), ex.notes as string]),
      ),
    );
    setRepTops(
      Object.fromEntries(
        plan.exercises.flatMap((ex) => {
          // Program leg work carries its own load suggestion.
          if (ex.program) return [];
          const top = templateRepTop(ex.targetReps, ex.notes);
          return top != null ? [[exerciseKey(ex.exerciseName), top]] : [];
        }),
      ),
    );
    setValues((current) => ({
      ...current,
      sessionName: planRequest.name,
      programSessionId: planRequest.programSessionId ?? undefined,
      sets: plan.exercises.flatMap((ex) =>
        planExerciseSets(ex, lastByExercise[exerciseKey(ex.exerciseName)]),
      ),
    }));
    // Only re-run when a plan is requested; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRequest]);

  // Declared before the restore effect so the mount pass skips it and cannot
  // erase a draft before it is read back.
  useEffect(() => {
    if (mode !== "create" || !draftChecked.current) return;
    const named = values.sets.some((set) => set.exerciseName.trim());
    writeDraft(
      named
        ? {
            savedAt: Date.now(),
            values,
            exerciseNotes,
            planNotes,
            repTops,
            restMeta,
          }
        : null,
    );
  }, [mode, values, exerciseNotes, planNotes, repTops, restMeta]);

  useEffect(() => {
    if (mode !== "create") return;
    const draft = readDraft();
    if (draft && draftWasSaved(draft, latestCreatedAt)) {
      writeDraft(null);
      resetWorkout();
    } else if (draft && !draftChecked.current) {
      setValues(draft.values);
      setExerciseNotes(draft.exerciseNotes);
      setPlanNotes(draft.planNotes);
      setRepTops(draft.repTops ?? {});
      setRestMeta(draft.restMeta ?? {});
      setRestoredAt(draft.savedAt);
    }
    draftChecked.current = true;
    // resetWorkout only calls state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, latestCreatedAt]);

  function resetWorkout() {
    setValues(toStrengthFormValues(null));
    setExerciseNotes({});
    setPlanNotes(null);
    setRepTops({});
    setRestMeta({});
    setNextCue(null);
    setRestEndsAt(null);
    setRestoredAt(null);
  }

  function discardDraft() {
    writeDraft(null);
    resetWorkout();
  }

  function markSubmitted() {
    if (mode !== "create") return;
    const draft = readDraft();
    if (draft) writeDraft({ ...draft, submittedAt: Date.now() });
  }

  useEffect(() => {
    if (restEndsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [restEndsAt]);

  const restRemaining = restSecondsLeft(restEndsAt, now);

  // Keep the screen on through the rest; let it sleep once rest is over.
  useScreenWakeLock(restRunning(restEndsAt, now));

  useEffect(() => {
    if (!restEndDue(restEndsAt, now, restCued.current)) return;
    restCued.current = true;
    // Back on the page long after rest ended: no stale beep, just the buzz.
    if (restBeepFresh(restEndsAt, now)) beep(2);
    try {
      // Android buzz; iOS Safari ignores it, hence the beep.
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Vibration is a nicety; ignore unsupported browsers.
    }
  }, [restEndsAt, now, beep]);

  /** Called from a tap, which is when iOS lets the beep's audio start. */
  function startRest(seconds: number = restSeconds) {
    unlockAudio();
    restCued.current = false;
    setNow(Date.now());
    setRestEndsAt(Date.now() + seconds * 1000);
  }

  function updateSet(index: number, next: Partial<StrengthSetFormValue>) {
    setValues((current) => ({
      ...current,
      sets: current.sets.map((set, i) =>
        i === index ? { ...set, ...next } : set,
      ),
    }));
  }

  /** Reps on a left-leg set also become the matching right set's target. */
  function updateReps(index: number, groupIndexes: number[], reps: string) {
    setValues((current) => {
      const sets = current.sets.map((set, i) =>
        i === index ? { ...set, reps } : set,
      );
      return {
        ...current,
        sets: withRightRepsFromLeft(sets, groupIndexes, index, reps),
      };
    });
  }

  /**
   * Ticking a set starts the rest. Program rows follow their rules: no rest
   * between legs or inside a superset (just "what's next"), the pair rest
   * after the last item, else the category's rest. Other rows use the timer.
   */
  function toggleDone(index: number) {
    const wasDone = Boolean(values.sets[index]?.done);
    updateSet(index, { done: !wasDone });
    if (wasDone) return;
    const call = restForTick(values.sets, index, restMeta);
    if (!call) {
      setNextCue(null);
      startRest();
      return;
    }
    setNextCue(call.next);
    if (call.seconds > 0) startRest(call.seconds);
    else setRestEndsAt(null);
  }

  function addSet(groupIndexes: number[]) {
    const lastIndex = groupIndexes[groupIndexes.length - 1] ?? 0;
    const source = values.sets[lastIndex];
    if (!source) return;
    setValues((current) => {
      const copy = (side?: "left" | "right") => ({
        ...createEmptyStrengthSet({
          exerciseName: source.exerciseName,
          reps: source.reps,
          weight: source.weight,
          rir: source.rir,
          durationSeconds: source.durationSeconds,
          side,
          peakForceNewtons:
            source.peakForceNewtons !== undefined ? "" : undefined,
        }),
        done: false,
      });
      const sets = [...current.sets];
      // Per-leg work adds a left + right pair.
      const added = source.side ? [copy("left"), copy("right")] : [copy()];
      sets.splice(lastIndex + 1, 0, ...added);
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
    if (!lastSession || !confirmReplace("your last session")) return;
    setRestoredAt(null);
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
              isWarmup: set.isWarmup,
              durationSeconds:
                set.durationSeconds != null ? `${set.durationSeconds}` : "",
              distanceMeters:
                set.distanceMeters != null ? `${set.distanceMeters}` : "",
              ...(set.side ? { side: set.side } : {}),
              ...(set.peakForceNewtons != null ? { peakForceNewtons: "" } : {}),
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

  // The logger always holds one blank set, so key off named exercises: an
  // empty workout gets no bar and no 10rem of bottom padding.
  const showSaveBar = mode === "edit" || hasNamedSets;

  return (
    <section className={`space-y-4 ${showSaveBar ? "pb-40" : ""}`}>
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

      {restoredAt != null && mode === "create" ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-pine/25 bg-pine/5 px-4 py-3 text-sm text-ink">
          <span suppressHydrationWarning>
            Unsaved workout restored (
            {new Date(restoredAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
            ).
          </span>
          <button
            type="button"
            onClick={discardDraft}
            className="h-9 shrink-0 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink"
          >
            Discard
          </button>
        </div>
      ) : null}

      {/* Field errors have no inline home in the logger, so show them here
          too; otherwise a rejected save looks like nothing happened. */}
      {formError || state.error || state.fieldErrors ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {formError ??
            state.error ??
            Object.values(state.fieldErrors ?? {}).join(" ")}
        </div>
      ) : null}

      <form action={formAction} onSubmit={markSubmitted} className="space-y-4">
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
        {values.programSessionId ? (
          <input
            type="hidden"
            name="programSessionId"
            value={values.programSessionId}
          />
        ) : null}

        {!hasNamedSets ? (
          <p className="rounded-2xl border border-ink/10 bg-sand/45 px-4 py-6 text-center text-sm text-ink/70">
            Start a plan, copy your last session, or add an exercise below.
          </p>
        ) : null}

        {groups.map((group) => {
          const first = values.sets[group.indexes[0] ?? 0];
          if (!first || !group.name.trim()) return null;
          const last = lastByExercise[group.key];
          const force = isForceSet(first);
          const timed = !force && isTimedSet(first);
          const addLoad =
            !timed && readyToAddLoad(last?.sets, repTops[group.key]);
          const timedWeight = timed && showsTimedWeight(first);
          const groupDone = group.indexes.filter(
            (i) => values.sets[i]?.done,
          ).length;

          return (
            <div
              key={`${group.key}-${group.indexes[0]}`}
              className="rounded-[1.5rem] border border-ink/10 bg-white px-2 py-3 shadow-sm sm:px-3"
            >
              <div className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">
                    {restMeta[group.key]?.supersetGroup ? (
                      <span className="mr-1.5 text-sm tabular-nums text-pine">
                        {restMeta[group.key]?.supersetGroup}
                        {restMeta[group.key]?.supersetOrder ?? ""}
                      </span>
                    ) : null}
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
                      {addLoad ? (
                        <span className="ml-1.5 inline-block rounded-full border border-pine/20 bg-pine/10 px-2 py-0.5 text-xs font-semibold text-pine">
                          Add weight
                          <span className="sr-only">
                            : every set last time reached {repTops[group.key]}{" "}
                            reps, the top of the range
                          </span>
                        </span>
                      ) : null}
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
                    className="h-11 w-11 rounded-full text-lg text-ember active:bg-ember/10"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {group.indexes.map((index) => {
                  const set = values.sets[index];
                  if (!set) return null;
                  const label = setLabel(
                    values.sets,
                    group.indexes,
                    index,
                    set.setNumber,
                  );
                  return (
                    <div
                      key={index}
                      className={`grid items-center gap-1 rounded-2xl p-0.5 ${
                        force || (timed && !timedWeight)
                          ? "grid-cols-[1.25rem_minmax(0,1fr)_2.75rem]"
                          : timed
                            ? "grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem]"
                            : // Weight ("182.5") needs more room than reps.
                              "grid-cols-[1.25rem_minmax(0,1.2fr)_minmax(0,1fr)_2.75rem]"
                      } ${set.done ? "bg-pine/10" : ""}`}
                    >
                      <button
                        type="button"
                        aria-label={`Set ${label}: tap to toggle warm-up`}
                        onClick={() =>
                          updateSet(index, { isWarmup: !set.isWarmup })
                        }
                        className={`h-12 text-sm font-semibold ${
                          set.isWarmup ? "text-ember" : "text-ink/60"
                        }`}
                      >
                        {set.isWarmup ? "W" : label}
                      </button>
                      {force ? (
                        <Stepper
                          label={`Peak newtons for set ${label}`}
                          value={set.peakForceNewtons ?? ""}
                          step={10}
                          onChange={(next) =>
                            updateSet(index, { peakForceNewtons: next })
                          }
                        />
                      ) : timed ? (
                        <>
                          {timedWeight ? (
                            <Stepper
                              decimal
                              label={`Weight for set ${label}`}
                              value={set.weight}
                              step={Number(set.weight) >= 45 ? 5 : 2.5}
                              onChange={(next) =>
                                updateSet(index, { weight: next })
                              }
                            />
                          ) : null}
                          <Stepper
                            label={`Seconds for set ${label}`}
                            value={set.durationSeconds}
                            step={5}
                            onChange={(next) =>
                              updateSet(index, { durationSeconds: next })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <Stepper
                            decimal
                            label={`Weight for set ${label}`}
                            value={set.weight}
                            step={Number(set.weight) >= 45 ? 5 : 2.5}
                            onChange={(next) =>
                              updateSet(index, { weight: next })
                            }
                          />
                          <Stepper
                            label={`Reps for set ${label}`}
                            value={set.reps}
                            step={1}
                            onChange={(next) =>
                              updateReps(index, group.indexes, next)
                            }
                          />
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={`Mark set ${label} ${set.done ? "not done" : "done"}`}
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
                {timed || force ? (
                  force ? (
                    <span className="text-xs text-ink/60">Peak N</span>
                  ) : null
                ) : (
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
                      // Start linked today's session; another day matches by date.
                      programSessionId: undefined,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-ink">
                Session name
                <input
                  className={fieldClassName()}
                  placeholder="Mon Push"
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

        {/* Nothing to save on an empty workout, so no bar. */}
        {showSaveBar ? (
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 space-y-2 border-t border-ink/10 bg-white/95 px-3 pb-3 pt-2 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            {restEndsAt == null && nextCue && mode === "create" ? (
              <div className="flex h-12 items-center justify-between gap-2 rounded-2xl bg-pine px-3 text-white">
                <span className="min-w-0 truncate text-base font-semibold">
                  No rest · {nextCue}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setNextCue(null)}
                  className="h-11 w-11 shrink-0 text-lg text-white/70"
                >
                  ×
                </button>
              </div>
            ) : null}
            {restEndsAt != null && mode === "create" ? (
              <div className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-ink px-3 py-1 text-white">
                <span className="min-w-0">
                  <span className="block text-lg font-semibold tabular-nums">
                    {restRemaining > 0
                      ? `Rest ${formatClock(restRemaining)}`
                      : "Rest over, go"}
                  </span>
                  {nextCue ? (
                    <span className="block truncate text-xs text-white/70">
                      {nextCue}
                    </span>
                  ) : null}
                </span>
                <div className="flex items-center gap-1">
                  {REST_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setRestSeconds(option);
                        startRest(option);
                      }}
                      className={`h-11 rounded-full px-2.5 text-xs font-semibold ${
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
                    onClick={() => {
                      setRestEndsAt(null);
                      setNextCue(null);
                    }}
                    className="h-11 w-11 text-lg text-white/70"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}
            <SaveButton label={saveLabel} pendingLabel="Saving..." />
          </div>
        ) : null}
      </form>
    </section>
  );
}
