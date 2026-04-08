"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { CardioSession, JournalEntry } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { formatCardioLinkLabel, toJournalFormValues } from "../helpers";
import type { JournalActionState, JournalFormValues } from "../types";

type JournalEntryFormProps = {
  mode: "create" | "edit";
  entry: JournalEntry | null;
  cardioSessions: CardioSession[];
  action: (
    state: JournalActionState,
    formData: FormData,
  ) => Promise<JournalActionState>;
  formError?: string;
};

const initialState: JournalActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-32 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

export function JournalEntryForm({
  mode,
  entry,
  cardioSessions,
  action,
  formError,
}: JournalEntryFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<JournalFormValues>(() => toJournalFormValues(entry));
  const [showDeepEntry, setShowDeepEntry] = useState(mode === "edit");

  useEffect(() => {
    setValues(toJournalFormValues(entry));
    setShowDeepEntry(mode === "edit");
  }, [entry, mode]);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Journal
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === "edit" ? "Edit entry" : "New entry"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Write a note, add tags, and pick a date. Title and links are optional.
          </p>
        </div>

        {mode === "edit" ? (
          <Link
            href="/journal"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            Cancel edit
          </Link>
        ) : null}
      </div>

      {formError || state.error ? (
        <div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {formError ?? state.error}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 space-y-5">
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Date
            <input
              className={fieldClassName()}
              name="entryDate"
              type="date"
              value={values.entryDate}
              onChange={(event) =>
                setValues((current) => ({ ...current, entryDate: event.target.value }))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Tags
            <input
              className={fieldClassName()}
              name="tags"
              placeholder="cardio, review, recovery"
              value={values.tags}
              onChange={(event) =>
                setValues((current) => ({ ...current, tags: event.target.value }))
              }
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Entry
          <textarea
            className={textAreaClassName()}
            name="body"
            placeholder="What happened, what mattered, or what felt different?"
            value={values.body}
            onChange={(event) =>
              setValues((current) => ({ ...current, body: event.target.value }))
            }
          />
        </label>

        <div>
          <button
            type="button"
            onClick={() => setShowDeepEntry((value) => !value)}
            className="text-sm font-semibold text-pine underline-offset-4 hover:underline"
          >
            {showDeepEntry ? "Hide optional fields" : "Add title or link to a workout"}
          </button>
        </div>

        {showDeepEntry ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-ink/10 bg-sand/50 p-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Title
              <input
                className={fieldClassName()}
                name="title"
                value={values.title}
                onChange={(event) =>
                  setValues((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Related week
                <input
                  className={fieldClassName()}
                  name="relatedWeekStart"
                  type="date"
                  value={values.relatedWeekStart}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      relatedWeekStart: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Linked workout
                <select
                  className={fieldClassName()}
                  name="relatedCardioSessionId"
                  value={values.relatedCardioSessionId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      relatedCardioSessionId: event.target.value,
                    }))
                  }
                >
                  <option value="">No linked workout</option>
                  {cardioSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatCardioLinkLabel(session)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

          </div>
        ) : null}

        <div className="flex justify-end">
          <AuthSubmitButton
            idleLabel={mode === "edit" ? "Update entry" : "Save entry"}
            pendingLabel={mode === "edit" ? "Updating..." : "Saving..."}
          />
        </div>
      </form>
    </section>
  );
}
