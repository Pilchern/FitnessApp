import type {
  KneeCheck,
  KneeReadinessStatus,
  KneeSwelling,
} from "@fitness-app/domain";

export const KNEE_SWELLING_OPTIONS: { value: KneeSwelling; label: string }[] = [
  { value: "none", label: "0" },
  { value: "trace", label: "Trace" },
  { value: "1+", label: "1+" },
  { value: "2+", label: "2+" },
];

/**
 * Session call from the morning knee check; null until all three answers exist.
 *
 * - knee_off: swelling 1+ or more, OR graft pain above 3, OR extension not full.
 * - normal: swelling 0 or trace, AND pain 2 or less, AND extension full.
 * - hold (repeat loads): everything in between, i.e. pain exactly 3 with
 *   swelling 0 or trace and full extension. The plan names "trace swelling
 *   with pain 3"; pain 3 with no swelling is treated the same, since it is
 *   neither normal (pain 2 or less) nor a day off (pain above 3).
 */
export function kneeReadinessStatus(
  check: KneeCheck | null | undefined,
): KneeReadinessStatus | null {
  if (
    !check ||
    check.swelling == null ||
    check.graftPain == null ||
    check.extensionFull == null
  ) {
    return null;
  }
  const swellingHigh = check.swelling === "1+" || check.swelling === "2+";
  if (swellingHigh || check.graftPain > 3 || !check.extensionFull) {
    return "knee_off";
  }
  if (check.graftPain <= 2) return "normal";
  return "hold";
}

export const KNEE_STATUS_COPY: Record<
  KneeReadinessStatus,
  { label: string; detail: string }
> = {
  normal: {
    label: "Normal",
    detail: "Full session. Load increases allowed.",
  },
  hold: {
    label: "Repeat loads",
    detail: "Same loads as last time. Landing prep is off today.",
  },
  knee_off: {
    label: "Knee day off",
    detail:
      "Leg block becomes 15 min of ROM and an easy walk. Upper body still runs. Thursday intervals become Zone 2.",
  },
};
