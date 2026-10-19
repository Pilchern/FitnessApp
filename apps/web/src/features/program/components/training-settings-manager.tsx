"use client";

import { useActionState } from "react";
import type { TrainingSetting } from "@fitness-app/domain";
import { updateTrainingSettingAction } from "../actions";

/** Text settings; everything else is a number. */
const TEXT_KEYS = new Set(["ortho_name", "ortho_phone"]);

function SettingRow({ setting }: { setting: TrainingSetting }) {
  const [state, action, pending] = useActionState(
    updateTrainingSettingAction,
    {},
  );
  const text = TEXT_KEYS.has(setting.key);
  const error = state.error ?? Object.values(state.fieldErrors ?? {}).join(" ");
  return (
    <li className="py-2.5">
      <form action={action} className="space-y-1">
        <input type="hidden" name="key" value={setting.key} />
        <input type="hidden" name="kind" value={text ? "text" : "number"} />
        <label
          htmlFor={`setting-${setting.key}`}
          className="block text-sm text-ink"
        >
          {setting.label}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`setting-${setting.key}`}
            name="value"
            inputMode={
              text
                ? setting.key === "ortho_phone"
                  ? "tel"
                  : "text"
                : "decimal"
            }
            defaultValue={
              text ? (setting.textValue ?? "") : (setting.value ?? "")
            }
            className="h-11 min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 text-base text-ink"
          />
          {setting.unit ? (
            <span className="w-12 shrink-0 text-xs text-ink/55">
              {setting.unit}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="h-11 shrink-0 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {state.saved && !pending ? "Saved" : "Save"}
          </button>
        </div>
        {error ? <p className="text-xs text-ember">{error}</p> : null}
      </form>
    </li>
  );
}

/**
 * Program targets and thresholds (load steps, sleep cut-off, quad-set
 * target, knee-check pain cut-offs, walk-jog steps, who to call). Blank
 * falls back to the built-in default.
 */
export function TrainingSettingsManager({
  settings,
}: {
  settings: TrainingSetting[];
}) {
  if (settings.length === 0) return null;
  const groups = [...new Set(settings.map((s) => s.groupName))];
  return (
    <section
      id="targets"
      className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6"
    >
      <h2 className="font-display text-lg text-ink">Program targets</h2>
      <p className="mt-1 text-sm text-ink/60">
        The progression engine, knee check and walk-jog read these. Blank uses
        the default.
      </p>
      {groups.map((group) => (
        <div key={group} className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">
            {group}
          </h3>
          <ul className="divide-y divide-ink/10">
            {settings
              .filter((s) => s.groupName === group)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <SettingRow key={s.key} setting={s} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
