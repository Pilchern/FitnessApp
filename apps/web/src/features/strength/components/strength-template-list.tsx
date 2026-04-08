"use client";

import type { TrainingTemplate } from "@fitness-app/domain";
import { isStrengthTemplateDefinition } from "@fitness-app/domain";
import { archiveStrengthTemplateAction } from "../actions";

type StrengthTemplateListProps = {
  templates: TrainingTemplate[];
  onLoad: (template: TrainingTemplate) => void;
};

export function StrengthTemplateList({
  templates,
  onLoad,
}: StrengthTemplateListProps) {
  if (templates.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        No templates yet. Create one to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const def = isStrengthTemplateDefinition(template.definition)
          ? template.definition
          : null;

        const exerciseNames = def
          ? def.exercises.map((ex) => ex.exerciseName).join(" · ")
          : "";

        const exerciseCount = def ? def.exercises.length : 0;

        return (
          <div
            key={template.id}
            className="flex flex-col gap-3 rounded-[1.5rem] border border-ink/10 bg-sand/45 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{template.name}</p>
              {def ? (
                <p className="mt-1 truncate text-sm text-ink/60">
                  {exerciseNames}
                  <span className="ml-2 text-ink/40">
                    ({exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""})
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onLoad(template)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-pine/30 px-4 text-sm font-semibold text-pine transition hover:bg-pine/10"
              >
                Load into form
              </button>

              <form action={archiveStrengthTemplateAction}>
                <input type="hidden" name="id" value={template.id} />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                >
                  Archive
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
