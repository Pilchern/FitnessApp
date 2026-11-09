"use client";

import { useActionState, useState } from "react";
import {
  craneSummary,
  EFFUSION_GRADES,
  lsiPct,
  quadLsiDenominator,
  type KneeTestEntry,
} from "@fitness-app/application";
import { AuthSubmitButton } from "@/components/shared/auth-submit-button";
import { saveKneeTestAction } from "../actions";
import type { KneeActionState } from "../types";

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-ink/10 bg-white px-2 text-center text-base text-ink outline-none focus:border-pine focus:ring-2 focus:ring-pine/20";
const fieldset = "rounded-2xl border border-ink/10 bg-sand/40 p-3";
const legend =
  "px-1 text-xs font-semibold uppercase tracking-[0.18em] text-pine";

type Values = Record<string, string>;

function num(values: Values, key: string): number | null {
  const raw = (values[key] ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const legs = (values: Values, prefix: string, count: number) => ({
  L: range(count).map((i) => num(values, `${prefix}.L.${i}`)),
  R: range(count).map((i) => num(values, `${prefix}.R.${i}`)),
});

function toEntry(values: Values): KneeTestEntry {
  const effusion = values.effusion ?? "";
  return {
    testDate: values.testDate ?? "",
    angleDeg: num(values, "angleDeg") ?? 90,
    strapNote: values.strapNote?.trim() || null,
    quadWarmup: legs(values, "wq", 2),
    quad: legs(values, "q", 3),
    ham: legs(values, "h", 3),
    flexionActive: num(values, "flexA"),
    flexionPassive: num(values, "flexP"),
    extension: num(values, "ext"),
    kneeGirth: { L: num(values, "kgL"), R: num(values, "kgR") },
    thighGirth: { L: num(values, "tgL"), R: num(values, "tgR") },
    heelHeight: num(values, "heelH"),
    sitToStand: { L: num(values, "stsL"), R: num(values, "stsR") },
    heelToButt: { L: num(values, "htbL"), R: num(values, "htbR") },
    stepDownLeftClean:
      values.stepDown === "clean"
        ? true
        : values.stepDown === "faults"
          ? false
          : null,
    walkingAsymmetry: num(values, "asym"),
    walkingSpeed: num(values, "speed"),
    steps: num(values, "steps"),
    effusionGrade: effusion === "" ? null : Number(effusion),
    aclRsi: num(values, "rsi"),
    hops: {
      single: legs(values, "hop.single", 3),
      triple: legs(values, "hop.triple", 3),
      crossover: legs(values, "hop.crossover", 3),
      timed6m: legs(values, "hop.timed6m", 3),
    },
    notes: values.notes?.trim() || null,
  };
}

const HOPS = [
  { key: "single", label: "Single hop (cm)" },
  { key: "triple", label: "Triple hop (cm)" },
  { key: "crossover", label: "Crossover hop (cm)" },
  { key: "timed6m", label: "6 m timed hop (s)" },
] as const;

/**
 * The knee test: the crane isometric protocol first (2 warm-up pulls per
 * side, then 3 max pulls alternating R / L), then the other readings. The
 * summary updates as pulls are typed. L = operated knee.
 */
export function KneeTestForm({
  today,
  spreadLimitN,
  rightBests,
}: {
  today: string;
  spreadLimitN: number;
  /** Right-leg crane best per earlier test date, oldest first (90° only). */
  rightBests: { date: string; right: number }[];
}) {
  const [state, action] = useActionState<KneeActionState, FormData>(
    saveKneeTestAction,
    {},
  );
  const [values, setValues] = useState<Values>({
    testDate: today,
    angleDeg: "90",
  });
  const set = (key: string) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const box = (key: string, label: string, decimal = true) => (
    <input
      className={inputClass}
      inputMode={decimal ? "decimal" : "numeric"}
      aria-label={label}
      value={values[key] ?? ""}
      onChange={set(key)}
    />
  );

  const entry = toEntry(values);
  const crane = craneSummary(entry.quad, entry.ham, spreadLimitN);
  const angle = entry.angleDeg;
  // At 90° the LSI uses the same denominator rule as the saved tests.
  const todayRight = crane.quad.R.best;
  const quadBasis =
    angle === 90
      ? quadLsiDenominator(
          [
            ...rightBests
              .filter((r) => r.date < entry.testDate)
              .map((r) => r.right),
            ...(todayRight != null ? [todayRight] : []),
          ],
          todayRight,
        )
      : null;
  const quadLsi = quadBasis
    ? lsiPct(crane.quad.L.best, quadBasis.denominator)
    : crane.lsi;

  /** One leg's row of pulls: "R" then three boxes. */
  const pullRow = (
    prefix: string,
    side: "L" | "R",
    count: number,
    what: string,
  ) => (
    <div className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] items-center gap-2">
      <span className="text-sm font-semibold text-ink/70">{side}</span>
      {range(count).map((i) => (
        <div key={i}>
          {box(`${prefix}.${side}.${i}`, `${what} ${side} ${i + 1}`)}
        </div>
      ))}
    </div>
  );

  const sideLine = (side: "L" | "R") => {
    const s = crane.quad[side];
    if (s.best == null) return null;
    return (
      <li className="flex justify-between gap-2">
        <span>
          {side === "L" ? "Left (op)" : "Right"} best {s.best} N
          {s.spread != null ? ` · spread ${s.spread} N` : ""}
        </span>
        {s.spreadFlag ? (
          <span className="font-semibold text-ember">
            over {spreadLimitN} N: retest or note why
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="entry" value={JSON.stringify(entry)} />
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
          Saved {state.saved.rows} values for {state.saved.date}.
        </p>
      ) : null}

      <label className="grid gap-1 text-sm text-ink">
        Test date
        <input
          className={`${inputClass} text-left`}
          type="date"
          value={values.testDate ?? ""}
          onChange={set("testDate")}
          required
        />
      </label>

      <fieldset className={fieldset}>
        <legend className={legend}>Crane isometric (quad)</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-ink/80">
            Knee angle (°)
            {box("angleDeg", "Knee angle", false)}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Strap height
            <input
              className={`${inputClass} text-left`}
              value={values.strapNote ?? ""}
              onChange={set("strapNote")}
              placeholder="e.g. 2 fingers above ankle"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-ink/60">
          Warm-up: 2 sub-max pulls per side (saved, not scored).
        </p>
        <div className="mt-1 space-y-2">
          {(["R", "L"] as const).map((side) => (
            <div
              key={side}
              className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] items-center gap-2"
            >
              <span className="text-sm font-semibold text-ink/50">{side}</span>
              {range(2).map((i) => (
                <div key={i}>
                  {box(`wq.${side}.${i}`, `Warm-up ${side} ${i + 1}`)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/60">
          Max pulls (N), alternate R1, L1, R2, L2, R3, L3. Best of 3 counts.
        </p>
        <div className="mt-1 space-y-2">
          {pullRow("q", "R", 3, "Quad pull")}
          {pullRow("q", "L", 3, "Quad pull")}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink/70">
            Hamstring pulls (for H:Q)
          </summary>
          <div className="mt-2 space-y-2">
            {pullRow("h", "R", 3, "Hamstring pull")}
            {pullRow("h", "L", 3, "Hamstring pull")}
          </div>
        </details>
        {crane.quad.L.best != null || crane.quad.R.best != null ? (
          <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-ink">
            <p className="font-semibold">
              Quad LSI {angle}°: {quadLsi != null ? `${quadLsi}%` : "–"}
              {quadLsi != null && quadBasis?.basis === "right_best" ? (
                <span className="font-normal text-ink/60">
                  {" "}
                  vs R best {quadBasis.denominator} N
                </span>
              ) : null}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink/75">
              {sideLine("L")}
              {sideLine("R")}
              {crane.hq.L != null || crane.hq.R != null ? (
                <li>
                  H:Q L {crane.hq.L ?? "–"} · R {crane.hq.R ?? "–"}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Range of motion, left knee (°)</legend>
        <div className="grid grid-cols-3 gap-3">
          <label className="grid gap-1 text-xs text-ink/80">
            Flexion active
            {box("flexA", "Flexion active")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Flexion passive
            {box("flexP", "Flexion passive")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Extension
            {box("ext", "Extension")}
          </label>
        </div>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Girth (cm) and effusion</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-ink/80">
            Knee L (mid-kneecap){box("kgL", "Knee girth L")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Knee R{box("kgR", "Knee girth R")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Thigh L (10 cm above){box("tgL", "Thigh girth L")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Thigh R{box("tgR", "Thigh girth R")}
          </label>
          <label className="col-span-2 grid gap-1 text-xs text-ink/80">
            Stroke test
            <select
              className={inputClass}
              value={values.effusion ?? ""}
              onChange={set("effusion")}
            >
              <option value="">Not done</option>
              {EFFUSION_GRADES.map((g, i) => (
                <option key={g} value={i}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Every 2 weeks</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-ink/80">
            Sit-to-stand L (reps){box("stsL", "Sit-to-stand L", false)}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Sit-to-stand R{box("stsR", "Sit-to-stand R", false)}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Heel-to-butt L (cm){box("htbL", "Heel-to-butt L")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Heel-to-butt R{box("htbR", "Heel-to-butt R")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Heel height diff (cm){box("heelH", "Heel height difference")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Step-down, left
            <select
              className={inputClass}
              value={values.stepDown ?? ""}
              onChange={set("stepDown")}
            >
              <option value="">Not done</option>
              <option value="clean">Clean</option>
              <option value="faults">Valgus, pelvic drop or trunk lean</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Walking (Apple Health)</legend>
        <div className="grid grid-cols-3 gap-3">
          <label className="grid gap-1 text-xs text-ink/80">
            Asymmetry %{box("asym", "Walking asymmetry")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Speed m/s{box("speed", "Walking speed")}
          </label>
          <label className="grid gap-1 text-xs text-ink/80">
            Steps/day{box("steps", "Steps per day", false)}
          </label>
        </div>
      </fieldset>

      <details className={fieldset}>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-pine">
          Later: ACL-RSI and hop tests
        </summary>
        <label className="mt-3 grid gap-1 text-xs text-ink/80">
          ACL-RSI total % (monthly){box("rsi", "ACL-RSI")}
        </label>
        {HOPS.map((h) => (
          <div key={h.key} className="mt-3">
            <p className="text-xs text-ink/70">{h.label}, 3 trials</p>
            <div className="mt-1 space-y-2">
              {pullRow(`hop.${h.key}`, "R", 3, h.label)}
              {pullRow(`hop.${h.key}`, "L", 3, h.label)}
            </div>
          </div>
        ))}
      </details>

      <label className="grid gap-1 text-sm text-ink">
        Notes
        <textarea
          className="min-h-16 rounded-xl border border-ink/10 bg-white px-3 py-2 text-base text-ink"
          value={values.notes ?? ""}
          onChange={set("notes")}
        />
      </label>

      <p className="text-xs text-ink/55">
        Saving a date again replaces only the sections you filled in.
      </p>
      <AuthSubmitButton idleLabel="Save test" pendingLabel="Saving..." />
    </form>
  );
}
