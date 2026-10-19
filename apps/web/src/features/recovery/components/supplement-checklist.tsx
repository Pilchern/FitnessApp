"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Supplement } from "@fitness-app/domain";
import type { SupplementChecklistActionState } from "../types";

type SupplementChecklistProps = {
  supplements: Supplement[];
  takenSupplementIds: string[];
  logDate: string;
  /** Where to land after saving; the action only honors /recovery and /dashboard. */
  returnTo?: "/recovery" | "/dashboard";
  /** Days taken in the last 7, keyed by supplement id, shown as "n/7". */
  weekCounts?: Record<string, number>;
  /** Extra text after an item's name, e.g. synced steps on the steps habit. */
  itemNotes?: Record<string, string>;
  /** A link shown at the end of an item's row, e.g. a habit's guided routine. */
  itemLinks?: Record<string, { href: string; label: string }>;
  labels?: ChecklistLabels;
  action: (
    state: SupplementChecklistActionState,
    formData: FormData,
  ) => Promise<SupplementChecklistActionState>;
};

type ChecklistLabels = {
  eyebrow: string;
  title: string;
  empty: string;
  hint: string;
  save: string;
};

const SUPPLEMENT_LABELS: ChecklistLabels = {
  eyebrow: "Supplements",
  title: "Today's supplements",
  empty: "You haven't added any supplements yet.",
  hint: "",
  save: "Save supplements",
};

const initialState: SupplementChecklistActionState = {};

function checkboxClassName() {
  return "h-5 w-5 rounded border-ink/20 text-pine focus:ring-pine";
}

export function SupplementChecklist({
  supplements,
  takenSupplementIds,
  logDate,
  returnTo = "/recovery",
  weekCounts,
  itemNotes,
  itemLinks,
  labels = SUPPLEMENT_LABELS,
  action,
}: SupplementChecklistProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped on each tap; the effect saves after React has committed the new
  // checked state, so the form data carries it.
  const [saveRequest, setSaveRequest] = useState(0);
  useEffect(() => {
    // Dispatched directly rather than via requestSubmit: React resets a
    // submitted <form action>, which would untick the boxes on screen.
    const form = formRef.current;
    if (saveRequest > 0 && form) {
      startTransition(() => formAction(new FormData(form)));
    }
  }, [saveRequest, formAction]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      supplements.map((supplement) => [
        supplement.id,
        takenSupplementIds.includes(supplement.id),
      ]),
    ),
  );

  if (supplements.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
        <h2 className="font-display text-lg text-ink">{labels.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/75">
          {labels.empty}{" "}
          <Link
            href="/settings"
            className="font-semibold text-pine underline-offset-4 hover:underline"
          >
            Add some in Settings
          </Link>{" "}
          to track daily adherence here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-ink">{labels.title}</h2>
        <span className="text-xs text-ink/50" aria-live="polite">
          {isPending ? "Saving..." : null}
        </span>
      </div>
      {labels.hint ? (
        <p className="mt-1 text-sm leading-6 text-ink/60">{labels.hint}</p>
      ) : null}

      {state.error ? (
        <div className="mt-4 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        className="mt-3 divide-y divide-ink/5"
      >
        <input type="hidden" name="logDate" value={logDate} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {supplements.map((supplement) => (
          <div key={supplement.id} className="flex items-center gap-3">
            <input type="hidden" name="supplementIds" value={supplement.id} />
            <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 py-1 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className={checkboxClassName()}
                name={`supplement_${supplement.id}`}
                checked={checked[supplement.id] ?? false}
                onChange={(event) => {
                  const next = event.target.checked;
                  setChecked((current) => ({
                    ...current,
                    [supplement.id]: next,
                  }));
                  setSaveRequest((n) => n + 1);
                }}
              />
              <span className="flex-1">
                {supplement.name}
                {itemNotes?.[supplement.id] ? (
                  <span className="ml-2 text-xs font-normal text-ink/50">
                    {itemNotes[supplement.id]}
                  </span>
                ) : null}
              </span>
              {weekCounts ? (
                <span className="text-xs font-normal text-ink/50">
                  {weekCounts[supplement.id] ?? 0}/7
                </span>
              ) : null}
            </label>
            {itemLinks?.[supplement.id] ? (
              <Link
                href={itemLinks[supplement.id]!.href}
                className="inline-flex h-9 shrink-0 items-center rounded-full border border-pine/30 px-3 text-xs font-semibold text-pine hover:bg-pine/5"
              >
                {itemLinks[supplement.id]!.label}
              </Link>
            ) : null}
          </div>
        ))}

        <noscript>
          <button
            type="submit"
            className="mt-3 text-sm font-semibold text-pine"
          >
            {labels.save}
          </button>
        </noscript>
      </form>
    </section>
  );
}
