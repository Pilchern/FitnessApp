/**
 * Where you stand against people of your age and sex, for the two markers with
 * usable published norms. Unlike readiness (you against yourself, day to day),
 * this describes fitness level and moves over months.
 *
 * VO2 max: FRIEND registry treadmill percentiles, Kaminsky et al., "Updated
 * Reference Standards for Cardiorespiratory Fitness Measured with
 * Cardiopulmonary Exercise Testing", Mayo Clin Proc 2022;97(2):285-293,
 * Table 3 (RER >= 1.0). Directly measured VO2peak in apparently healthy US
 * adults. Apple Watch's VO2 max is an estimate, so the percentile is too.
 *
 * Resting heart rate: Quer et al., "Inter- and intraindividual variability in
 * daily resting heart rate...", PLOS ONE 2020;15(2):e0227709. 92,457 adults on
 * wearables: 95% of men between 50 and 80 bpm, women 53 to 82. The paper gives
 * no age-by-sex tables, so this compares by sex only (sex and age together
 * explained 6% of the variance) using a normal fit to those 95% ranges.
 */

export type PeerSex = "male" | "female";

const FRIEND_PERCENTILES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

/** Decade start -> VO2 (mL/kg/min) at each of FRIEND_PERCENTILES. */
const FRIEND_TREADMILL: Record<PeerSex, Record<number, number[]>> = {
  male: {
    20: [28.6, 35.2, 40.0, 43.6, 46.5, 49.0, 51.9, 54.5, 58.6],
    30: [24.9, 29.8, 33.5, 37.0, 39.7, 43.4, 46.4, 50.0, 55.5],
    40: [22.1, 26.7, 29.7, 32.4, 35.3, 37.9, 40.9, 45.2, 50.8],
    50: [18.6, 22.2, 24.5, 26.9, 29.2, 31.8, 34.3, 38.3, 43.4],
    60: [15.8, 18.5, 20.7, 22.8, 24.6, 26.5, 28.7, 32.0, 37.1],
    70: [13.6, 15.9, 17.3, 19.1, 20.6, 22.2, 23.8, 25.9, 29.4],
    80: [12.9, 14.8, 16.1, 16.6, 17.6, 18.4, 20.0, 21.4, 22.8],
  },
  female: {
    20: [22.5, 27.2, 30.8, 34.0, 36.6, 39.0, 41.8, 44.8, 49.0],
    30: [18.6, 21.9, 24.2, 26.4, 28.3, 31.0, 33.6, 37.0, 42.1],
    40: [17.2, 19.7, 21.8, 23.9, 25.7, 27.7, 30.0, 33.0, 37.8],
    50: [16.5, 18.5, 20.1, 21.5, 22.9, 24.6, 26.3, 28.4, 32.4],
    60: [13.4, 15.4, 17.0, 18.3, 19.6, 20.9, 22.4, 24.3, 27.3],
    70: [12.3, 14.0, 15.2, 16.2, 17.2, 18.3, 19.6, 20.8, 22.8],
    80: [11.4, 12.6, 13.7, 14.7, 15.4, 16.0, 17.3, 18.4, 20.8],
  },
};

/** 95% ranges from Quer 2020, as a normal fit: mean +/- 1.96 SD. */
const RESTING_HR_RANGE: Record<PeerSex, [number, number]> = {
  male: [50, 80],
  female: [53, 82],
};

export type PeerPercentile = {
  /** 10-90 inside the table; outside it, the edge with `beyond` set. */
  percentile: number;
  beyond: "below" | "above" | null;
};

export type PeerMarker = {
  key: "vo2Max" | "restingHeartRate";
  label: string;
  value: number;
  unit: string;
  rank: PeerPercentile;
  /** Plain-language placement, e.g. "Better than 62% of men 30-39". */
  summary: string;
  /** What the next band takes, when there is one. */
  next: string | null;
};

export type PeerFitness =
  | { status: "needsProfile"; missing: ("birth date" | "sex")[] }
  | {
      status: "ready";
      age: number;
      ageBand: string;
      markers: PeerMarker[];
      /** Markers with no data yet, and how to get it. */
      pending: { key: PeerMarker["key"]; label: string; hint: string }[];
    };

export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function decadeOf(age: number) {
  return Math.min(80, Math.max(20, Math.floor(age / 10) * 10));
}

/** Linear interpolation of `value` across a FRIEND row. */
export function vo2MaxPercentile(
  value: number,
  age: number,
  sex: PeerSex,
): PeerPercentile {
  const row = FRIEND_TREADMILL[sex][decadeOf(age)]!;
  if (value < row[0]!) return { percentile: 10, beyond: "below" };
  if (value > row[row.length - 1]!) return { percentile: 90, beyond: "above" };
  for (let i = 1; i < row.length; i += 1) {
    const lo = row[i - 1]!;
    const hi = row[i]!;
    if (value <= hi) {
      const share = hi === lo ? 1 : (value - lo) / (hi - lo);
      const p = FRIEND_PERCENTILES[i - 1]! + share * 10;
      return { percentile: Math.round(p), beyond: null };
    }
  }
  return { percentile: 90, beyond: null };
}

/** VO2 needed for each FRIEND band at this age and sex. */
export function vo2MaxAtPercentile(
  percentile: (typeof FRIEND_PERCENTILES)[number],
  age: number,
  sex: PeerSex,
): number {
  return FRIEND_TREADMILL[sex][decadeOf(age)]![
    FRIEND_PERCENTILES.indexOf(percentile)
  ]!;
}

/** Standard normal CDF (Abramowitz-Stegun 26.2.17, error < 7.5e-8). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const tail =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}

/** Share of peers (by sex) with a HIGHER resting HR, as a percentile 1-99. */
export function restingHeartRatePercentile(
  bpm: number,
  sex: PeerSex,
): PeerPercentile {
  const [low, high] = RESTING_HR_RANGE[sex];
  const mean = (low + high) / 2;
  const sd = (high - low) / (2 * 1.96);
  const better = 1 - normalCdf((bpm - mean) / sd);
  const percentile = Math.round(better * 100);
  if (percentile < 1) return { percentile: 1, beyond: "below" };
  if (percentile > 99) return { percentile: 99, beyond: "above" };
  return { percentile, beyond: null };
}

function placement(rank: PeerPercentile, peers: string) {
  if (rank.beyond === "above")
    return `Top ${100 - rank.percentile}% of ${peers}`;
  if (rank.beyond === "below") {
    return `Bottom ${rank.percentile}% of ${peers}`;
  }
  return `Better than ${rank.percentile}% of ${peers}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Resting HR readings needed before ranking: one week. */
const MIN_RESTING_HR_DAYS = 7;

export function buildPeerFitness(input: {
  today: string;
  birthDate: string | null;
  sex: "male" | "female" | "unspecified" | null;
  /** Latest Apple Watch VO2 max estimate. */
  vo2Max: { value: number; date: string } | null;
  /** Daily resting HR readings from the last 30 days. */
  restingHeartRates: number[];
}): PeerFitness {
  const missing: ("birth date" | "sex")[] = [];
  if (!input.birthDate) missing.push("birth date");
  if (input.sex !== "male" && input.sex !== "female") missing.push("sex");
  if (missing.length > 0 || !input.birthDate) {
    return { status: "needsProfile", missing };
  }
  const sex = input.sex as PeerSex;
  const age = ageOn(input.birthDate, input.today);
  const decade = decadeOf(age);
  const ageBand = `${decade}-${decade + 9}`;
  const peers = `${sex === "male" ? "men" : "women"} ${ageBand}`;
  const markers: PeerMarker[] = [];
  const pending: Extract<PeerFitness, { status: "ready" }>["pending"] = [];

  if (input.vo2Max) {
    const rank = vo2MaxPercentile(input.vo2Max.value, age, sex);
    const nextBand = ([50, 70, 80, 90] as const).find(
      (p) => p > rank.percentile && rank.beyond !== "above",
    );
    markers.push({
      key: "vo2Max",
      label: "VO2 max",
      value: Math.round(input.vo2Max.value * 10) / 10,
      unit: "mL/kg/min",
      rank,
      summary: placement(rank, peers),
      next:
        nextBand != null
          ? `${vo2MaxAtPercentile(nextBand, age, sex)} for the ${nextBand}th percentile`
          : null,
    });
  } else {
    pending.push({
      key: "vo2Max",
      label: "VO2 max",
      hint: "No Apple Watch reading yet. Record an Outdoor Walk workout, 20+ minutes on flat ground.",
    });
  }

  const recentRhr = input.restingHeartRates.filter((v) => v > 0);
  if (recentRhr.length >= MIN_RESTING_HR_DAYS) {
    const bpm = Math.round(median(recentRhr));
    const rank = restingHeartRatePercentile(bpm, sex);
    markers.push({
      key: "restingHeartRate",
      label: "Resting HR, 30-day median",
      value: bpm,
      unit: "bpm",
      rank,
      summary: placement(rank, sex === "male" ? "men" : "women"),
      next: null,
    });
  } else {
    pending.push({
      key: "restingHeartRate",
      label: "Resting HR",
      hint: `Needs ${MIN_RESTING_HR_DAYS} days of synced resting heart rate; ${recentRhr.length} so far.`,
    });
  }

  return { status: "ready", age, ageBand, markers, pending };
}
