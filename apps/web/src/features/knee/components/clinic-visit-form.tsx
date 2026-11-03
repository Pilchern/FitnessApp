"use client";

import { useActionState, useState } from "react";
import type { ClinicVisit } from "@fitness-app/application";
import { AuthSubmitButton } from "@/components/shared/auth-submit-button";
import { saveClinicVisitAction } from "../actions";
import type { KneeActionState } from "../types";

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/20";

function num(raw: string | undefined): number | null {
  const v = (raw ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A PT or surgeon visit: what the clinic measured, saved apart from home tests. */
export function ClinicVisitForm({ today }: { today: string }) {
  const [state, action] = useActionState<KneeActionState, FormData>(
    saveClinicVisitAction,
    {},
  );
  const [v, setV] = useState<Record<string, string>>({
    visitDate: today,
    lefsMax: "80",
  });
  const set = (key: string) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [key]: e.target.value }));
  const visit: ClinicVisit = {
    visitDate: v.visitDate ?? "",
    provider: v.provider?.trim() || null,
    flexionActive: num(v.flexA),
    flexionPassive: num(v.flexP),
    extension: num(v.ext),
    mmt: v.mmt?.trim() || null,
    lefs: num(v.lefs),
    lefsMax: num(v.lefsMax) ?? 80,
    notes: v.notes?.trim() || null,
  };
  const field = (key: string, label: string, mode = "decimal") => (
    <label className="grid gap-1 text-xs text-ink/80">
      {label}
      <input
        className={inputClass}
        inputMode={mode as "decimal" | "text"}
        value={v[key] ?? ""}
        onChange={set(key)}
      />
    </label>
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="visit" value={JSON.stringify(visit)} />
      {state.error || state.fieldErrors ? (
        <p
          role="alert"
          className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember"
        >
          {state.error ?? Object.values(state.fieldErrors ?? {}).join(" ")}
        </p>
      ) : null}
      {state.saved ? (
        <p className="rounded-2xl border border-pine/20 bg-pine/10 px-4 py-3 text-sm text-pine">
          Saved the {state.saved.date} visit.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-ink/80">
          Visit date
          <input
            className={inputClass}
            type="date"
            value={v.visitDate ?? ""}
            onChange={set("visitDate")}
            required
          />
        </label>
        {field("provider", "Provider", "text")}
        {field("flexA", "Flexion active (°)")}
        {field("flexP", "Flexion passive (°)")}
        {field("ext", "Extension (°)")}
        {field("mmt", "Quad MMT (e.g. 4+/5)", "text")}
        {field("lefs", "LEFS")}
        {field("lefsMax", "LEFS out of")}
      </div>
      <label className="grid gap-1 text-xs text-ink/80">
        Notes
        <textarea
          className="min-h-16 rounded-xl border border-ink/10 bg-white px-3 py-2 text-base text-ink"
          value={v.notes ?? ""}
          onChange={set("notes")}
        />
      </label>
      <AuthSubmitButton idleLabel="Save visit" pendingLabel="Saving..." />
    </form>
  );
}
