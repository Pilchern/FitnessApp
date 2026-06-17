"use client";

import type { ReactNode } from "react";
import { useActionState, useMemo, useState } from "react";
import { calculateWeeklyReviewScore } from "@fitness-app/application";
import type { WeeklyReviewSummary } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { WeeklyReviewSummaryCard } from "@/components/shared/weekly-review-summary-card";
import { formatWeeklyReviewDate, toWeeklyReviewFormValues } from "../helpers";
import { saveWeeklyReviewAction } from "../actions";
import type {
  WeeklyReviewActionState,
  WeeklyReviewAutoPopulated,
  WeeklyReviewFormValues,
  WeeklyReviewPageData,
} from "../types";

type WeeklyReviewFormProps = {
  data: WeeklyReviewPageData;
};

const initialState: WeeklyReviewActionState = {};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

function textAreaClassName() {
  return "min-h-28 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

type AutoFieldKey =
  | "averageWeightLb"
  | "waistIn"
  | "liftsCompleted"
  | "ridesCompleted"
  | "zone2Minutes"
  | "vo2Completed"
  | "sleepAverageHours"
  | "alcoholTotal";

type AutoFieldProps = {
  label: string;
  fieldKey: AutoFieldKey;
  autoValueLabel: string;
  manualOverride: boolean;
  onReset: () => void;
  children: ReactNode;
  fieldError?: string;
};

function AutoField({
  label,
  fieldKey,
  autoValueLabel,
  manualOverride,
  onReset,
  children,
  fieldError,
}: AutoFieldProps) {
  return (
    <div className="rounded-[1.25rem] border border-ink/10 bg-sand/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-ink" htmlFor={fieldKey}>
          {label}
        </label>
        <div
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            manualOverride
              ? "border-ember/20 bg-ember/10 text-ember"
              : "border-pine/20 bg-pine/10 text-pine"
          }`}
        >
          {manualOverride ? "Manual" : "Auto"}
        </div>
      </div>
      <div className="mt-3">
        {children}
      </div>
      {fieldError ? (
        <p className="mt-2 text-xs text-ember">{fieldError}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink/60">
        <span>{autoValueLabel}</span>
        {manualOverride ? (
          <button
            type="button"
            onClick={onReset}
            className="font-semibold text-pine underline-offset-4 hover:underline"
          >
            Reset to logged value
          </button>
        ) : (
          <span>From your log</span>
        )}
      </div>
    </div>
  );
}

type AutoPopulatedStatProps = {
  label: string;
  value: string;
};

function AutoPopulatedStat({ label, value }: AutoPopulatedStatProps) {
  return (
    <div className="rounded-[1.25rem] border border-pine/15 bg-pine/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-ink/70">{label}</span>
        <span className="rounded-full border border-pine/20 bg-pine/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-pine">
          Auto-filled
        </span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

type AutoPopulatedPanelProps = {
  autoPopulated: WeeklyReviewAutoPopulated;
};

function AutoPopulatedPanel({ autoPopulated }: AutoPopulatedPanelProps) {
  const hasNutritionData = autoPopulated.nutritionLogCount > 0;
  const hasReadinessData = autoPopulated.averageReadiness != null;

  if (!hasNutritionData && !hasReadinessData) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-2xl text-ink">From your logs</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Additional context pulled from your nutrition and recovery data.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {autoPopulated.proteinHitDays != null && (
          <AutoPopulatedStat
            label="Protein hit"
            value={`${autoPopulated.proteinHitDays} / ${autoPopulated.nutritionLogCount} days`}
          />
        )}
        {autoPopulated.fiberTakenDays != null && (
          <AutoPopulatedStat
            label="Fiber taken"
            value={`${autoPopulated.fiberTakenDays} / ${autoPopulated.nutritionLogCount} days`}
          />
        )}
        {autoPopulated.nutritionAdherencePct != null && (
          <AutoPopulatedStat
            label="Nutrition adherence"
            value={`${autoPopulated.nutritionAdherencePct}%`}
          />
        )}
        {autoPopulated.averageReadiness != null && (
          <AutoPopulatedStat
            label="Avg readiness"
            value={`${autoPopulated.averageReadiness} / 10`}
          />
        )}
      </div>
    </div>
  );
}

function buildSummaryFromValues(values: WeeklyReviewFormValues): WeeklyReviewSummary {
  const parseNumber = (value: string) => {
    if (!value.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return {
    averageWeightLb: parseNumber(values.averageWeightLb),
    waistIn: parseNumber(values.waistIn),
    liftsCompleted: parseNumber(values.liftsCompleted),
    ridesCompleted: parseNumber(values.ridesCompleted),
    zone2Minutes: parseNumber(values.zone2Minutes),
    vo2Completed: values.vo2Completed === "true",
    sleepAverageHours: parseNumber(values.sleepAverageHours),
    alcoholTotal: parseNumber(values.alcoholTotal),
  };
}

export function WeeklyReviewForm({ data }: WeeklyReviewFormProps) {
  const [state, formAction] = useActionState(saveWeeklyReviewAction, initialState);
  const [values, setValues] = useState(() =>
    toWeeklyReviewFormValues(data.review, data.autoSummary, data.weekStart, data.weekEnd),
  );

  const scoringPreview = useMemo(
    () =>
      calculateWeeklyReviewScore({
        summary: buildSummaryFromValues(values),
        confidence: values.confidence ? Number(values.confidence) : null,
      }),
    [values],
  );

  const setAutoFieldValue = (fieldKey: AutoFieldKey, nextValue: string) => {
    setValues((current) => ({
      ...current,
      [fieldKey]: nextValue,
      manualOverrides: {
        ...current.manualOverrides,
        [fieldKey]:
          nextValue !==
          (data.autoSummary[fieldKey] == null
            ? fieldKey === "vo2Completed"
              ? "false"
              : ""
            : `${data.autoSummary[fieldKey]}`),
      },
    }));
  };

  const resetAutoField = (fieldKey: AutoFieldKey) => {
    const autoValue = data.autoSummary[fieldKey];
    setValues((current) => ({
      ...current,
      [fieldKey]:
        fieldKey === "vo2Completed"
          ? autoValue === true
            ? "true"
            : "false"
          : autoValue == null
            ? ""
            : `${autoValue}`,
      manualOverrides: {
        ...current.manualOverrides,
        [fieldKey]: false,
      },
    }));
  };

  const resetAllAutoFields = () => {
    const { autoSummary } = data;
    setValues((current) => ({
      ...current,
      averageWeightLb:
        autoSummary.averageWeightLb == null ? "" : `${autoSummary.averageWeightLb}`,
      waistIn: autoSummary.waistIn == null ? "" : `${autoSummary.waistIn}`,
      liftsCompleted:
        autoSummary.liftsCompleted == null ? "" : `${autoSummary.liftsCompleted}`,
      ridesCompleted:
        autoSummary.ridesCompleted == null ? "" : `${autoSummary.ridesCompleted}`,
      zone2Minutes: autoSummary.zone2Minutes == null ? "" : `${autoSummary.zone2Minutes}`,
      vo2Completed: autoSummary.vo2Completed === true ? "true" : "false",
      sleepAverageHours:
        autoSummary.sleepAverageHours == null ? "" : `${autoSummary.sleepAverageHours}`,
      alcoholTotal: autoSummary.alcoholTotal == null ? "" : `${autoSummary.alcoholTotal}`,
      manualOverrides: {},
    }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      <section className="space-y-6 rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
              Weekly review
            </p>
            <h1 className="mt-3 font-display text-2xl md:text-4xl text-ink">
              {formatWeeklyReviewDate(data.weekStart)} - {formatWeeklyReviewDate(data.weekEnd)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
              Your week, summarised. Numbers are pulled from your logs — adjust
              any that don&apos;t look right, then add your reflections and save.
            </p>
          </div>

          <form action="/weekly-review" className="flex items-end gap-3">
            <div className="grid gap-2 text-sm font-medium text-ink">
              <label htmlFor="weekStartPicker">Week start</label>
              <input
                id="weekStartPicker"
                name="weekStart"
                type="date"
                defaultValue={data.weekStart}
                className={fieldClassName()}
              />
              <p className="text-xs text-ink/50">
                Pick a {data.weekStartsOn === 1 ? "Monday" : "Sunday"}
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Load week
            </button>
          </form>
        </div>

        {state.error || data.formError ? (
          <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
            {data.formError ?? state.error}
          </div>
        ) : null}

        <form action={formAction} className="space-y-6">
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
          <input type="hidden" name="weekStart" value={values.weekStart} />
          <input type="hidden" name="weekEnd" value={values.weekEnd} />
          <input
            type="hidden"
            name="manualOverrides"
            value={JSON.stringify(values.manualOverrides)}
          />

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-2xl text-ink">This week&apos;s numbers</h2>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Pulled from your logs. Edit any value that doesn&apos;t look right.
                </p>
              </div>
              <button
                type="button"
                onClick={resetAllAutoFields}
                className="shrink-0 inline-flex h-10 items-center gap-2 self-start rounded-full border border-pine/25 bg-pine/8 px-4 text-sm font-semibold text-pine transition hover:bg-pine/15"
              >
                ↺ Refresh from logs
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AutoField
                label="Average weight (lb)"
                fieldKey="averageWeightLb"
                autoValueLabel={`Auto: ${
                  data.autoSummary.averageWeightLb != null
                    ? `${data.autoSummary.averageWeightLb} lb`
                    : "no data"
                }`}
                manualOverride={Boolean(values.manualOverrides.averageWeightLb)}
                onReset={() => resetAutoField("averageWeightLb")}
                fieldError={state.fieldErrors?.averageWeightLb}
              >
                <input
                  id="averageWeightLb"
                  name="averageWeightLb"
                  className={fieldClassName()}
                  inputMode="decimal"
                  value={values.averageWeightLb}
                  onChange={(event) =>
                    setAutoFieldValue("averageWeightLb", event.target.value)
                  }
                />
              </AutoField>

              <AutoField
                label="Waist (in)"
                fieldKey="waistIn"
                autoValueLabel={`Auto: ${
                  data.autoSummary.waistIn != null ? `${data.autoSummary.waistIn} in` : "no data"
                }`}
                manualOverride={Boolean(values.manualOverrides.waistIn)}
                onReset={() => resetAutoField("waistIn")}
                fieldError={state.fieldErrors?.waistIn}
              >
                <input
                  id="waistIn"
                  name="waistIn"
                  className={fieldClassName()}
                  inputMode="decimal"
                  value={values.waistIn}
                  onChange={(event) => setAutoFieldValue("waistIn", event.target.value)}
                />
              </AutoField>

              <AutoField
                label="Lifts completed"
                fieldKey="liftsCompleted"
                autoValueLabel={`Auto: ${data.autoSummary.liftsCompleted ?? 0}`}
                manualOverride={Boolean(values.manualOverrides.liftsCompleted)}
                onReset={() => resetAutoField("liftsCompleted")}
                fieldError={state.fieldErrors?.liftsCompleted}
              >
                <input
                  id="liftsCompleted"
                  name="liftsCompleted"
                  className={fieldClassName()}
                  inputMode="numeric"
                  value={values.liftsCompleted}
                  onChange={(event) =>
                    setAutoFieldValue("liftsCompleted", event.target.value)
                  }
                />
              </AutoField>

              <AutoField
                label="Cardio sessions"
                fieldKey="ridesCompleted"
                autoValueLabel={`Auto: ${data.autoSummary.ridesCompleted ?? 0}`}
                manualOverride={Boolean(values.manualOverrides.ridesCompleted)}
                onReset={() => resetAutoField("ridesCompleted")}
                fieldError={state.fieldErrors?.ridesCompleted}
              >
                <input
                  id="ridesCompleted"
                  name="ridesCompleted"
                  className={fieldClassName()}
                  inputMode="numeric"
                  value={values.ridesCompleted}
                  onChange={(event) =>
                    setAutoFieldValue("ridesCompleted", event.target.value)
                  }
                />
              </AutoField>

              <AutoField
                label="Zone 2 minutes"
                fieldKey="zone2Minutes"
                autoValueLabel={`Auto: ${data.autoSummary.zone2Minutes ?? 0} min`}
                manualOverride={Boolean(values.manualOverrides.zone2Minutes)}
                onReset={() => resetAutoField("zone2Minutes")}
                fieldError={state.fieldErrors?.zone2Minutes}
              >
                <input
                  id="zone2Minutes"
                  name="zone2Minutes"
                  className={fieldClassName()}
                  inputMode="numeric"
                  value={values.zone2Minutes}
                  onChange={(event) => setAutoFieldValue("zone2Minutes", event.target.value)}
                />
              </AutoField>

              <AutoField
                label="VO2 completed"
                fieldKey="vo2Completed"
                autoValueLabel={`Auto: ${data.autoSummary.vo2Completed ? "Yes" : "No"}`}
                manualOverride={Boolean(values.manualOverrides.vo2Completed)}
                onReset={() => resetAutoField("vo2Completed")}
                fieldError={state.fieldErrors?.vo2Completed}
              >
                <select
                  id="vo2Completed"
                  name="vo2Completed"
                  className={fieldClassName()}
                  value={values.vo2Completed}
                  onChange={(event) => setAutoFieldValue("vo2Completed", event.target.value)}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </AutoField>

              <AutoField
                label="Sleep average (hours)"
                fieldKey="sleepAverageHours"
                autoValueLabel={`Auto: ${
                  data.autoSummary.sleepAverageHours != null
                    ? `${data.autoSummary.sleepAverageHours}h`
                    : "no data"
                }`}
                manualOverride={Boolean(values.manualOverrides.sleepAverageHours)}
                onReset={() => resetAutoField("sleepAverageHours")}
                fieldError={state.fieldErrors?.sleepAverageHours}
              >
                <input
                  id="sleepAverageHours"
                  name="sleepAverageHours"
                  className={fieldClassName()}
                  inputMode="decimal"
                  value={values.sleepAverageHours}
                  onChange={(event) =>
                    setAutoFieldValue("sleepAverageHours", event.target.value)
                  }
                />
              </AutoField>

              <AutoField
                label="Alcohol total"
                fieldKey="alcoholTotal"
                autoValueLabel={`Auto: ${
                  data.autoSummary.alcoholTotal != null ? data.autoSummary.alcoholTotal : "no data"
                }`}
                manualOverride={Boolean(values.manualOverrides.alcoholTotal)}
                onReset={() => resetAutoField("alcoholTotal")}
                fieldError={state.fieldErrors?.alcoholTotal}
              >
                <input
                  id="alcoholTotal"
                  name="alcoholTotal"
                  className={fieldClassName()}
                  inputMode="numeric"
                  value={values.alcoholTotal}
                  onChange={(event) => setAutoFieldValue("alcoholTotal", event.target.value)}
                />
              </AutoField>
            </div>
          </div>

          <AutoPopulatedPanel autoPopulated={data.autoPopulated} />

          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl text-ink">Your reflection</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                One win, one miss, one lesson, one priority. Keep it short.
              </p>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-ink">
                Best win
                <textarea
                  className={textAreaClassName()}
                  name="bestWin"
                  value={values.bestWin}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, bestWin: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Biggest miss
                <textarea
                  className={textAreaClassName()}
                  name="biggestMiss"
                  value={values.biggestMiss}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      biggestMiss: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Lesson
                <textarea
                  className={textAreaClassName()}
                  name="lesson"
                  value={values.lesson}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, lesson: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Next week priority
                <textarea
                  className={textAreaClassName()}
                  name="nextWeekPriority"
                  value={values.nextWeekPriority}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      nextWeekPriority: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Confidence (1-10)
                <input
                  className={fieldClassName()}
                  name="confidence"
                  inputMode="numeric"
                  value={values.confidence}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, confidence: event.target.value }))
                  }
                />
                {state.fieldErrors?.confidence ? (
                  <p className="text-xs text-ember">{state.fieldErrors.confidence}</p>
                ) : null}
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <AuthSubmitButton
              idleLabel={values.id ? "Update weekly review" : "Save weekly review"}
              pendingLabel={values.id ? "Updating review..." : "Saving review..."}
            />
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Week score
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="font-display text-5xl text-ink">
                {scoringPreview.scoreDetails.totalScore}
              </div>
              <div className="mt-2 text-sm uppercase tracking-[0.2em] text-ink/60">
                {scoringPreview.scoreDetails.band}
              </div>
            </div>
            <div className="max-w-[11rem] text-right text-sm leading-6 text-ink/70">
              Based on training consistency and recovery quality.
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {scoringPreview.scoreDetails.components.map((component) => (
              <div
                key={component.key}
                className="rounded-[1.25rem] border border-ink/10 bg-sand/50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-ink">{component.label}</div>
                  <div className="text-sm font-semibold text-ink">
                    {component.score}/{component.maxScore}
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-ink/65">
                  {component.detail}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-pine/20 bg-pine/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-pine">
              Recommendation
            </div>
            <p className="mt-2 text-sm leading-6 text-ink">
              {scoringPreview.strategicDecision}
            </p>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-ember/20 bg-ember/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ember">
              Watch out for
            </div>
            <p className="mt-2 text-sm leading-6 text-ink">
              {scoringPreview.riskForecast}
            </p>
          </div>
        </section>

        <WeeklyReviewSummaryCard review={data.latestReview} />
      </aside>
    </div>
  );
}
