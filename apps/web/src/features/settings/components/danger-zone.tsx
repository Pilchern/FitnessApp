"use client";

import { useActionState } from "react";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import type { SettingsActionState } from "../types";

type DangerZoneProps = {
  deleteAccountAction: (
    state: SettingsActionState,
    formData: FormData,
  ) => Promise<SettingsActionState>;
};

const initialState: SettingsActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

export function DangerZone({ deleteAccountAction }: DangerZoneProps) {
  const [state, formAction] = useActionState(deleteAccountAction, initialState);

  return (
    <section className="rounded-[1.75rem] border border-ember/20 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">
        Danger zone
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">Your data</h2>

      <div className="mt-5 flex flex-col gap-3 border-b border-ink/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Export all your data</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            Downloads everything you&apos;ve logged — body metrics, cardio,
            strength sessions, recovery, nutrition, weekly reviews, journal
            entries, and more — as a single JSON file. Never includes
            integration credentials or tokens.
          </p>
        </div>
        <a
          href="/api/account/export"
          download
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Export my data
        </a>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-ink">Delete account</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          Permanently deletes your account and every row of data associated with
          it — body metrics, workouts, recovery check-ins, journal entries,
          connected integrations, all of it. This cannot be undone.
        </p>

        {state.error ? (
          <div className="mt-4 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
            {state.error}
          </div>
        ) : null}

        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="grid flex-1 gap-2 text-sm font-medium text-ink">
            Type DELETE to confirm
            <input
              className={fieldClassName()}
              name="confirmation"
              type="text"
              placeholder="DELETE"
              autoComplete="off"
            />
          </label>
          <ActionSubmitButton
            idleLabel="Delete my account"
            pendingLabel="Deleting..."
            tone="danger"
          />
        </form>
      </div>
    </section>
  );
}
