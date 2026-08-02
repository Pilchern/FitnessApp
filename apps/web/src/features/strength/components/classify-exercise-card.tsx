"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ExerciseMuscleGroupOverride } from "@fitness-app/domain";
import {
  archiveExerciseOverrideAction,
  classifyExerciseAction,
} from "../actions";
import type { StrengthActionState } from "../types";

const MUSCLE_GROUP_OPTIONS = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
  { value: "core", label: "Core" },
];

const MOVEMENT_PATTERN_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
];

const CATEGORY_OPTIONS = [
  { value: "compound", label: "Compound" },
  { value: "isolation", label: "Isolation" },
];

const initialState: StrengthActionState = {};

function selectClassName() {
  return "h-10 rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function ClassifySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/60"
    >
      {pending ? "Saving..." : "Classify"}
    </button>
  );
}

function ClassifyExerciseRow({ exerciseName }: { exerciseName: string }) {
  const [state, formAction] = useActionState(
    classifyExerciseAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-2 rounded-[1.25rem] border border-ink/10 bg-sand/45 p-3 sm:grid-cols-[1.3fr_0.9fr_0.7fr_0.8fr_auto] sm:items-center"
    >
      <input type="hidden" name="exerciseName" value={exerciseName} />
      <p className="truncate text-sm font-medium text-ink" title={exerciseName}>
        {exerciseName}
      </p>
      <select
        name="muscleGroup"
        aria-label={`Muscle group for ${exerciseName}`}
        className={selectClassName()}
        defaultValue=""
        required
      >
        <option value="" disabled>
          Muscle group
        </option>
        {MUSCLE_GROUP_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        name="movementPattern"
        aria-label={`Movement pattern for ${exerciseName}`}
        className={selectClassName()}
        defaultValue=""
        required
      >
        <option value="" disabled>
          Pattern
        </option>
        {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        name="category"
        aria-label={`Category for ${exerciseName}`}
        className={selectClassName()}
        defaultValue=""
        required
      >
        <option value="" disabled>
          Category
        </option>
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ClassifySubmitButton />
      {state.error ? (
        <p className="sm:col-span-5 text-xs text-ember">{state.error}</p>
      ) : null}
    </form>
  );
}

type ClassifyExerciseCardProps = {
  unclassifiedExerciseNames: string[];
  overrides: ExerciseMuscleGroupOverride[];
};

export function ClassifyExerciseCard({
  unclassifiedExerciseNames,
  overrides,
}: ClassifyExerciseCardProps) {
  if (unclassifiedExerciseNames.length === 0 && overrides.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Exercise catalog
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">
        Classify your exercises
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink/75">
        Teach the app a muscle group, movement pattern, and category for
        exercise names it doesn&apos;t recognize, so they count toward your
        muscle-group balance and push:pull ratio.
      </p>

      {unclassifiedExerciseNames.length > 0 ? (
        <div className="mt-5 space-y-3">
          {unclassifiedExerciseNames.map((name) => (
            <ClassifyExerciseRow key={name} exerciseName={name} />
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink/60">
          Every exercise you&apos;ve logged is already classified.
        </p>
      )}

      {overrides.length > 0 ? (
        <div className="mt-6 border-t border-ink/10 pt-5">
          <h3 className="text-sm font-semibold text-ink">
            Your classifications
          </h3>
          <div className="mt-3 space-y-2">
            {overrides.map((override) => (
              <div
                key={override.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-sand/30 px-4 py-2 text-sm"
              >
                <span className="truncate text-ink/80">
                  {override.exerciseName}
                  <span className="ml-2 text-ink/45">
                    {override.muscleGroup} · {override.movementPattern} ·{" "}
                    {override.category}
                  </span>
                </span>
                <form action={archiveExerciseOverrideAction}>
                  <input type="hidden" name="id" value={override.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-ember/20 px-3 py-1 text-xs font-semibold text-ember transition hover:bg-ember/10"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
