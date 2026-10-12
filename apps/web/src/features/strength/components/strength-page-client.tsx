"use client";

import { useState } from "react";
import type { TrainingTemplate } from "@fitness-app/domain";
import { isStrengthTemplateDefinition } from "@fitness-app/domain";
import type { StrengthTrainingTemplateDefinition } from "@fitness-app/application";
import type { StrengthSession } from "@fitness-app/domain";
import {
  createStrengthSessionAction,
  updateStrengthSessionAction,
} from "../actions";
import type { StrengthActionState } from "../types";
import type { LastExercisePerformance } from "../helpers";
import { StrengthQuickForm, type PlanRequest } from "./strength-quick-form";
import { StrengthTemplateSection } from "./strength-template-section";
import { TodaysPlanCallout } from "./todays-plan-callout";

type StrengthPageClientProps = {
  mode: "create" | "edit";
  session: StrengthSession | null;
  formError?: string;
  knownExercises: string[];
  lastSession: StrengthSession | null;
  strengthTemplates: TrainingTemplate[];
  todaysScheduledTemplate: TrainingTemplate | null;
  lastByExercise: Record<string, LastExercisePerformance>;
  latestCreatedAt: string | null;
};

export function StrengthPageClient({
  mode,
  session,
  formError,
  knownExercises,
  lastSession,
  strengthTemplates,
  todaysScheduledTemplate,
  lastByExercise,
  latestCreatedAt,
}: StrengthPageClientProps) {
  const [planRequest, setPlanRequest] = useState<PlanRequest | null>(null);

  function handleLoadTemplate(template: TrainingTemplate) {
    if (isStrengthTemplateDefinition(template.definition)) {
      // A fresh id per tap, so loading the same plan twice still reloads it.
      setPlanRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        name: template.name,
        definition: template.definition as StrengthTrainingTemplateDefinition,
      }));
    }
  }

  const action: (
    state: StrengthActionState,
    formData: FormData,
  ) => Promise<StrengthActionState> =
    mode === "edit" ? updateStrengthSessionAction : createStrengthSessionAction;
  // Editing a past session must never pull a plan over it.
  const onLoad = mode === "create" ? handleLoadTemplate : undefined;

  return (
    <>
      {/* Gone once a plan is loaded, so the workout starts at the top. */}
      {todaysScheduledTemplate && onLoad && planRequest == null ? (
        <TodaysPlanCallout template={todaysScheduledTemplate} onLoad={onLoad} />
      ) : null}

      {/* Keyed by mode so Edit -> Cancel remounts the logger and restores the
          in-progress workout draft instead of carrying edit state across. */}
      <StrengthQuickForm
        key={mode === "edit" ? `edit-${session?.id ?? ""}` : "create"}
        mode={mode}
        session={session}
        action={action}
        formError={formError}
        knownExercises={knownExercises}
        lastSession={lastSession}
        planRequest={mode === "create" ? planRequest : null}
        lastByExercise={lastByExercise}
        latestCreatedAt={latestCreatedAt}
      />

      <StrengthTemplateSection
        templates={strengthTemplates}
        onLoad={onLoad}
        knownExercises={knownExercises}
      />
    </>
  );
}
