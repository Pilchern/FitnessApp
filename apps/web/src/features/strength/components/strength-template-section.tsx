"use client";

import { useState } from "react";
import type { TrainingTemplate } from "@fitness-app/domain";
import { StrengthTemplateList } from "./strength-template-list";
import { StrengthTemplateForm } from "./strength-template-form";

type StrengthTemplateSectionProps = {
  templates: TrainingTemplate[];
  /** Omitted while editing a past session, which hides the Load buttons. */
  onLoad?: (template: TrainingTemplate) => void;
  knownExercises?: string[];
};

export function StrengthTemplateSection({
  templates,
  onLoad,
  knownExercises = [],
}: StrengthTemplateSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <details className="group rounded-[1.75rem] border border-ink/10 bg-white/80 shadow-panel">
      <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-6 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>
          Templates
          <span className="ml-2 font-normal text-ink/50">
            {templates.length}
          </span>
        </span>
        <span className="text-ink/50 group-open:hidden">+</span>
        <span className="hidden text-ink/50 group-open:inline">−</span>
      </summary>

      <div className="border-t border-ink/10 p-6 pt-5">
        <StrengthTemplateList templates={templates} onLoad={onLoad} />

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          {showCreateForm ? "Hide form" : "New template"}
        </button>

        {showCreateForm ? (
          <div className="mt-6">
            <StrengthTemplateForm knownExercises={knownExercises} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
