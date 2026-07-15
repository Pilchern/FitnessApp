"use client";

import { useActionState } from "react";
import type { Supplement } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import type { SupplementActionState } from "../types";

type SupplementsManagerProps = {
  supplements: Supplement[];
  createAction: (
    state: SupplementActionState,
    formData: FormData,
  ) => Promise<SupplementActionState>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
  reactivateAction: (formData: FormData) => void | Promise<void>;
};

const initialState: SupplementActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-2xl text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-ink/70">{description}</p>
      ) : null}
    </div>
  );
}

export function SupplementsManager({
  supplements,
  createAction,
  deactivateAction,
  reactivateAction,
}: SupplementsManagerProps) {
  const [state, formAction] = useActionState(createAction, initialState);
  const activeSupplements = supplements.filter((supplement) => supplement.isActive);
  const inactiveSupplements = supplements.filter(
    (supplement) => !supplement.isActive,
  );

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <SectionHeader
        eyebrow="Supplements"
        title="What you're tracking"
        description="Add supplements here, then check them off daily from the Recovery check-in. Deactivate a supplement to stop tracking it without losing its history."
      />

      {state.error ? (
        <div className="mb-4 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-2 text-sm font-medium text-ink">
          Supplement name
          <input
            className={fieldClassName()}
            name="name"
            type="text"
            placeholder="e.g. Creatine"
          />
          {state.fieldErrors?.name ? (
            <p className="text-xs text-ember">{state.fieldErrors.name}</p>
          ) : null}
        </label>
        <AuthSubmitButton idleLabel="Add supplement" pendingLabel="Adding..." />
      </form>

      {activeSupplements.length > 0 ? (
        <div className="mt-5 space-y-2">
          {activeSupplements.map((supplement) => (
            <div
              key={supplement.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-sand/40 px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">{supplement.name}</span>
              <form action={deactivateAction}>
                <input type="hidden" name="id" value={supplement.id} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-ember hover:text-ember"
                >
                  Deactivate
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink/60">
          No supplements yet. Add your first one above.
        </p>
      )}

      {inactiveSupplements.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
            Inactive
          </p>
          <div className="mt-2 space-y-2">
            {inactiveSupplements.map((supplement) => (
              <div
                key={supplement.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-ink/10 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-ink/50">
                  {supplement.name}
                </span>
                <form action={reactivateAction}>
                  <input type="hidden" name="id" value={supplement.id} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Reactivate
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
