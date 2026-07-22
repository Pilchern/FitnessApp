"use client";

import type { TrainingTemplate } from "@fitness-app/domain";
import { isStrengthTemplateDefinition } from "@fitness-app/domain";

type TodaysPlanCalloutProps = {
  template: TrainingTemplate;
  onLoad: (template: TrainingTemplate) => void;
};

export function TodaysPlanCallout({
  template,
  onLoad,
}: TodaysPlanCalloutProps) {
  const def = isStrengthTemplateDefinition(template.definition)
    ? template.definition
    : null;
  const exerciseNames = def?.exercises.map((ex) => ex.exerciseName).join(" · ");

  return (
    <section className="rounded-[1.75rem] border border-pine/30 bg-pine/5 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Today&apos;s plan
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-ink">{template.name}</h2>
          {exerciseNames ? (
            <p className="mt-1 truncate text-sm text-ink/70">{exerciseNames}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onLoad(template)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white transition hover:bg-pine/90"
        >
          Load today&apos;s plan
        </button>
      </div>
    </section>
  );
}
