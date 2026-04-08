"use client";

import { useState } from "react";
import type { TrainingTemplate } from "@fitness-app/domain";
import { StrengthTemplateList } from "./strength-template-list";
import { StrengthTemplateForm } from "./strength-template-form";

type StrengthTemplateSectionProps = {
  templates: TrainingTemplate[];
  onLoad: (template: TrainingTemplate) => void;
  knownExercises?: string[];
};

export function StrengthTemplateSection({
  templates,
  onLoad,
  knownExercises = [],
}: StrengthTemplateSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Workout templates
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            Your templates
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Define your program once and load it when starting a session.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          {showCreateForm ? "Hide form" : "Create template"}
        </button>
      </div>

      <div className="mt-5">
        <StrengthTemplateList templates={templates} onLoad={onLoad} />
      </div>

      {showCreateForm ? (
        <div className="mt-6">
          <StrengthTemplateForm knownExercises={knownExercises} />
        </div>
      ) : null}
    </section>
  );
}
