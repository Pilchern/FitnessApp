"use client";

import { useActionState, useState } from "react";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { COMMON_TIMEZONES, toSettingsFormValues } from "../helpers";
import type { SettingsActionState, SettingsFormValues } from "../types";
import type { UserProfile } from "@fitness-app/domain";

type SettingsFormProps = {
  profile: UserProfile;
  userEmail: string;
  action: (
    state: SettingsActionState,
    formData: FormData,
  ) => Promise<SettingsActionState>;
};

const initialState: SettingsActionState = {};

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

function GoalToggle({
  name,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-ink/10 bg-white p-4 transition hover:border-pine/30">
      <div className="pt-0.5">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 cursor-pointer rounded border-ink/20 accent-pine"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink/60">{description}</p>
      </div>
    </label>
  );
}

function RadioPill({
  name,
  value,
  currentValue,
  label,
  onChange,
}: {
  name: string;
  value: string;
  currentValue: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const isSelected = currentValue === value;
  return (
    <label
      className={`flex h-10 cursor-pointer items-center justify-center rounded-full border px-5 text-sm font-semibold transition ${
        isSelected
          ? "border-pine bg-pine text-white"
          : "border-ink/15 bg-white text-ink hover:border-pine hover:text-pine"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={isSelected}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export function SettingsForm({ profile, userEmail, action }: SettingsFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [values, setValues] = useState<SettingsFormValues>(() =>
    toSettingsFormValues(profile),
  );

  function set<K extends keyof SettingsFormValues>(
    key: K,
    value: SettingsFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      {/* ── Profile ── */}
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <SectionHeader
          eyebrow="Profile"
          title="Your identity"
          description="How your name appears throughout the app."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Display name
            <input
              className={fieldClassName()}
              name="displayName"
              type="text"
              placeholder="Athlete"
              value={values.displayName}
              onChange={(event) => set("displayName", event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Email address
            <div className="flex h-11 items-center rounded-2xl border border-ink/10 bg-mist/50 px-4 text-sm text-ink/60">
              {userEmail}
            </div>
          </label>
        </div>
      </section>

      {/* ── Preferences ── */}
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <SectionHeader
          eyebrow="Preferences"
          title="Display & formatting"
          description="Controls how dates, units, and times are shown across all modules."
        />

        <div className="space-y-5">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Timezone
            <select
              className={fieldClassName()}
              name="timezone"
              value={values.timezone}
              onChange={(event) => set("timezone", event.target.value)}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm font-medium text-ink">
              Units system
              <div className="flex gap-2">
                <RadioPill
                  name="unitsSystem"
                  value="imperial"
                  currentValue={values.unitsSystem}
                  label="Imperial (lb, in)"
                  onChange={(value) => set("unitsSystem", value)}
                />
                <RadioPill
                  name="unitsSystem"
                  value="metric"
                  currentValue={values.unitsSystem}
                  label="Metric (kg, cm)"
                  onChange={(value) => set("unitsSystem", value)}
                />
              </div>
            </div>

            <div className="grid gap-2 text-sm font-medium text-ink">
              Week starts on
              <div className="flex gap-2">
                <RadioPill
                  name="weekStartsOn"
                  value="1"
                  currentValue={values.weekStartsOn}
                  label="Monday"
                  onChange={(value) => set("weekStartsOn", value)}
                />
                <RadioPill
                  name="weekStartsOn"
                  value="0"
                  currentValue={values.weekStartsOn}
                  label="Sunday"
                  onChange={(value) => set("weekStartsOn", value)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Training Goals ── */}
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <SectionHeader
          eyebrow="Training Goals"
          title="What you're training for"
          description="These help personalise your Weekly Review and Insights. Toggle any that apply right now."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <GoalToggle
            name="goalFatLoss"
            label="Fat loss"
            description="Weight and waist trends matter most to you right now."
            checked={values.goalFatLoss}
            onChange={(next) => set("goalFatLoss", next)}
          />
          <GoalToggle
            name="goalPreserveMuscle"
            label="Preserve muscle"
            description="Keeping strength sessions consistent is a priority."
            checked={values.goalPreserveMuscle}
            onChange={(next) => set("goalPreserveMuscle", next)}
          />
          <GoalToggle
            name="goalImproveVo2"
            label="Improve VO2 max"
            description="Zone 2 and high-intensity cardio are part of your plan."
            checked={values.goalImproveVo2}
            onChange={(next) => set("goalImproveVo2", next)}
          />
        </div>
      </section>

      {/* ── Nutrition Goals ── */}
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <SectionHeader
          eyebrow="Nutrition Goals"
          title="Daily targets"
          description="Set optional daily targets. Leave blank to hide progress bars on the Nutrition page."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Daily protein (g)
            <input
              className={fieldClassName()}
              name="dailyProteinGramsTarget"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 180"
              value={values.dailyProteinGramsTarget}
              onChange={(event) => set("dailyProteinGramsTarget", event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Daily calories
            <input
              className={fieldClassName()}
              name="dailyCaloriesTarget"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 2200"
              value={values.dailyCaloriesTarget}
              onChange={(event) => set("dailyCaloriesTarget", event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Daily fiber (g)
            <input
              className={fieldClassName()}
              name="dailyFiberGramsTarget"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 30"
              value={values.dailyFiberGramsTarget}
              onChange={(event) => set("dailyFiberGramsTarget", event.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64">
          <AuthSubmitButton
            idleLabel="Save settings"
            pendingLabel="Saving..."
          />
        </div>
      </div>
    </form>
  );
}
