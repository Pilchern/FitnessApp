"use client";

import { useActionState, useState } from "react";
import type { DexaFieldGroup, DexaFieldSpec } from "@fitness-app/application";
import { AuthSubmitButton } from "@/components/shared/auth-submit-button";
import { saveDexaScanAction } from "../actions";
import type { DexaActionState, DexaPageData } from "../types";

const GROUPS: DexaFieldGroup[] = ["Total", "Regions", "Sides", "VAT and bone"];

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/20";

/**
 * Enter a scan from the report. Values are kept in state so a validation
 * error does not wipe 35 typed numbers. A second save on the same date
 * replaces that scan.
 */
export function DexaScanForm({
  fields,
  defaults,
}: {
  fields: DexaFieldSpec[];
  defaults: DexaPageData["defaults"];
}) {
  const [state, action] = useActionState<DexaActionState, FormData>(
    saveDexaScanAction,
    {},
  );
  const [values, setValues] = useState<Record<string, string>>({
    scanDate: "",
    facility: defaults.facility,
    machine: defaults.machine,
    heightIn: defaults.heightIn,
    notes: "",
  });
  const set = (key: string) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const fieldError = (key: string) =>
    state.fieldErrors?.[key] ? (
      <p className="text-xs text-ember">{state.fieldErrors[key]}</p>
    ) : null;

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="rounded-2xl border border-pine/20 bg-pine/10 px-4 py-3 text-sm text-pine">
          Saved the {state.saved} scan.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-ink">
          Scan date
          <input
            className={inputClass}
            type="date"
            name="scanDate"
            value={values.scanDate}
            onChange={set("scanDate")}
            required
          />
          {fieldError("scanDate")}
        </label>
        <label className="grid gap-1 text-sm text-ink">
          Height (in)
          <input
            className={inputClass}
            name="heightIn"
            inputMode="decimal"
            value={values.heightIn}
            onChange={set("heightIn")}
          />
          {fieldError("heightIn")}
        </label>
        <label className="grid gap-1 text-sm text-ink">
          Facility
          <input
            className={inputClass}
            name="facility"
            value={values.facility}
            onChange={set("facility")}
          />
        </label>
        <label className="grid gap-1 text-sm text-ink">
          Machine
          <input
            className={inputClass}
            name="machine"
            value={values.machine}
            onChange={set("machine")}
          />
        </label>
      </div>

      {GROUPS.map((group) => (
        <fieldset
          key={group}
          className="rounded-2xl border border-ink/10 bg-sand/40 p-3"
        >
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
            {group}
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields
              .filter((f) => f.group === group)
              .map((f) => (
                <label key={f.key} className="grid gap-1 text-xs text-ink/80">
                  {f.label}
                  {f.unit ? ` (${f.unit})` : ""}
                  <input
                    className={inputClass}
                    name={f.key}
                    inputMode="decimal"
                    value={values[f.key] ?? ""}
                    onChange={set(f.key)}
                  />
                  {fieldError(f.key)}
                </label>
              ))}
          </div>
        </fieldset>
      ))}

      <label className="grid gap-1 text-sm text-ink">
        Notes
        <textarea
          className="min-h-20 rounded-xl border border-ink/10 bg-white px-3 py-2 text-base text-ink"
          name="notes"
          value={values.notes}
          onChange={set("notes")}
        />
      </label>

      <AuthSubmitButton idleLabel="Save scan" pendingLabel="Saving scan..." />
    </form>
  );
}
