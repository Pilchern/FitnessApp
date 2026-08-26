"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Supplement } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import type { SupplementChecklistActionState } from "../types";

type SupplementChecklistProps = {
  supplements: Supplement[];
  takenSupplementIds: string[];
  logDate: string;
  action: (
    state: SupplementChecklistActionState,
    formData: FormData,
  ) => Promise<SupplementChecklistActionState>;
};

const initialState: SupplementChecklistActionState = {};

function checkboxClassName() {
  return "h-4 w-4 rounded border-ink/20 text-pine focus:ring-pine";
}

export function SupplementChecklist({
  supplements,
  takenSupplementIds,
  logDate,
  action,
}: SupplementChecklistProps) {
  const [state, formAction] = useActionState(action, initialState);
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
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Supplements
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">
          Today&apos;s supplements
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/75">
          You haven&apos;t added any supplements yet.{" "}
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
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Supplements
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">
        Today&apos;s supplements
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink/75">
        Check off what you took today. Unchecked items are saved as not taken.
      </p>

      {state.error ? (
        <div className="mt-4 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="mt-5 space-y-3">
        <input type="hidden" name="logDate" value={logDate} />
        {supplements.map((supplement) => (
          <div key={supplement.id}>
            <input type="hidden" name="supplementIds" value={supplement.id} />
            <label className="flex items-center gap-3 text-sm font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                className={checkboxClassName()}
                name={`supplement_${supplement.id}`}
                checked={checked[supplement.id] ?? false}
                onChange={(event) =>
                  setChecked((current) => ({
                    ...current,
                    [supplement.id]: event.target.checked,
                  }))
                }
              />
              {supplement.name}
            </label>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <AuthSubmitButton
            idleLabel="Save supplements"
            pendingLabel="Saving..."
          />
        </div>
      </form>
    </section>
  );
}
