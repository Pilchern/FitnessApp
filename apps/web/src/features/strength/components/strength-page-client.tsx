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
import { StrengthQuickForm } from "./strength-quick-form";
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
};

export function StrengthPageClient({
  mode,
  session,
  formError,
  knownExercises,
  lastSession,
  strengthTemplates,
  todaysScheduledTemplate,
}: StrengthPageClientProps) {
  const [loadedTemplate, setLoadedTemplate] =
    useState<StrengthTrainingTemplateDefinition | null>(null);

  function handleLoadTemplate(template: TrainingTemplate) {
    if (isStrengthTemplateDefinition(template.definition)) {
      setLoadedTemplate(template.definition as StrengthTrainingTemplateDefinition);
    }
  }

  const action: (
    state: StrengthActionState,
    formData: FormData,
  ) => Promise<StrengthActionState> =
    mode === "edit" ? updateStrengthSessionAction : createStrengthSessionAction;

  return (
    <>
      {todaysScheduledTemplate ? (
        <TodaysPlanCallout
          template={todaysScheduledTemplate}
          onLoad={handleLoadTemplate}
        />
      ) : null}

      <StrengthTemplateSection
        templates={strengthTemplates}
        onLoad={handleLoadTemplate}
        knownExercises={knownExercises}
      />

      <StrengthQuickForm
        mode={mode}
        session={session}
        action={action}
        formError={formError}
        knownExercises={knownExercises}
        lastSession={lastSession}
        loadedTemplate={loadedTemplate}
      />
    </>
  );
}
