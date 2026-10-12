/**
 * "What changed" notes for the dashboard: short, deterministic statements
 * about real changes in the data, computed on read (nothing is persisted).
 *
 * Each rule stays silent unless both windows it compares have enough data and
 * the change clears a threshold, so noise is not reported as progress and
 * missing data is never reported as a drop.
 */

export type TrendNoteTone = "positive" | "neutral" | "attention";

export type TrendNote = {
  key: string;
  tone: TrendNoteTone;
  text: string;
};

export type TrendNoteInput = {
  today: string;
  strengthSessions: {
    sessionDate: string;
    sets: {
      exerciseName: string;
      weight: number | null;
      reps: number | null;
      isWarmup: boolean;
    }[];
  }[];
  cardioSessions: {
    sessionDate: string;
    durationMinutes: number | null;
    plannedVsCompleted: string;
    sessionKind: string;
  }[];
  bodyMetrics: { measuredOn: string; weightLb: number | null }[];
  recovery: {
    checkinDate: string;
    restingHeartRate: number | null;
    wakeTimeLocal: string | null;
  }[];
  /** "HH:MM" wake target; when set, the wake note measures against it. */
  wakeTarget?: string | null;
};

const MAX_NOTES = 4;
/** Estimated-max change that counts as real, as a fraction (about one plate step on a mid-weight lift). */
const STRENGTH_CHANGE = 0.025;
const STRENGTH_SESSIONS = 4;
const CARDIO_CHANGE_MIN = 15;
const CARDIO_CHANGE_PCT = 0.15;
const WEIGHT_STABLE_LB = 1;
const RHR_CHANGE_BPM = 3;

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Epley, reps capped at 12 (same cap as the progression module). */
function estimatedMax(weight: number, reps: number) {
  return weight * (1 + Math.min(reps, 12) / 30);
}

function titleCase(name: string) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function strengthNotes(input: TrendNoteInput): TrendNote[] {
  const byExercise = new Map<string, { date: string; best: number }[]>();
  const sessions = [...input.strengthSessions].sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate),
  );
  for (const session of sessions) {
    const best = new Map<string, number>();
    for (const set of session.sets) {
      if (set.isWarmup || !set.weight || !set.reps) continue;
      const key = set.exerciseName.trim().toLowerCase();
      const score = estimatedMax(set.weight, set.reps);
      if (score > (best.get(key) ?? 0)) best.set(key, score);
    }
    for (const [key, score] of best) {
      const list = byExercise.get(key) ?? [];
      list.push({ date: session.sessionDate, best: score });
      byExercise.set(key, list);
    }
  }

  const notes: (TrendNote & { size: number })[] = [];
  for (const [name, history] of byExercise) {
    if (history.length < STRENGTH_SESSIONS) continue;
    const recent = history.slice(-STRENGTH_SESSIONS);
    const first = recent[0]!.best;
    const last = recent[recent.length - 1]!.best;
    const change = (last - first) / first;
    if (Math.abs(change) < STRENGTH_CHANGE) continue;
    const pct = Math.round(Math.abs(change) * 100);
    notes.push({
      key: `strength:${name}`,
      tone: change > 0 ? "positive" : "attention",
      text:
        change > 0
          ? `${titleCase(name)} is up ${pct}% (estimated max) over your last ${STRENGTH_SESSIONS} sessions.`
          : `${titleCase(name)} is down ${pct}% (estimated max) over your last ${STRENGTH_SESSIONS} sessions.`,
      size: Math.abs(change),
    });
  }
  return notes
    .sort((a, b) => b.size - a.size)
    .slice(0, 2)
    .map(({ size: _size, ...note }) => note);
}

function cardioNote(input: TrendNoteInput): TrendNote | null {
  const recentStart = addDays(input.today, -27);
  const priorStart = addDays(input.today, -55);
  const rides = input.cardioSessions.filter(
    (s) => s.plannedVsCompleted === "completed" && s.sessionKind !== "other",
  );
  const inWindow = (from: string, to: string) =>
    rides.filter((s) => s.sessionDate >= from && s.sessionDate <= to);
  const recent = inWindow(recentStart, input.today);
  const prior = inWindow(priorStart, addDays(recentStart, -1));
  if (recent.length < 2 || prior.length < 2) return null;

  const perWeek = (list: typeof rides) =>
    Math.round(list.reduce((s, r) => s + (r.durationMinutes ?? 0), 0) / 4);
  const now = perWeek(recent);
  const before = perWeek(prior);
  const delta = now - before;
  if (
    Math.abs(delta) < CARDIO_CHANGE_MIN ||
    Math.abs(delta) < before * CARDIO_CHANGE_PCT
  ) {
    return null;
  }
  return {
    key: "cardio",
    tone: delta > 0 ? "positive" : "attention",
    text: `Cardio is ${delta > 0 ? "up" : "down"} to ${now} min a week, from ${before}, over the last 4 weeks.`,
  };
}

function weightNote(input: TrendNoteInput): TrendNote | null {
  const avgBetween = (from: string, to: string) => {
    const values = input.bodyMetrics
      .filter(
        (m) => m.weightLb != null && m.measuredOn >= from && m.measuredOn <= to,
      )
      .map((m) => m.weightLb!);
    return values.length >= 2
      ? values.reduce((s, v) => s + v, 0) / values.length
      : null;
  };
  // Two-week windows, because weigh-ins are not daily.
  const now = avgBetween(addDays(input.today, -13), input.today);
  const before = avgBetween(
    addDays(input.today, -41),
    addDays(input.today, -28),
  );
  if (now == null || before == null) return null;
  const delta = round1(now - before);
  if (Math.abs(delta) < WEIGHT_STABLE_LB) {
    return {
      key: "weight",
      tone: "neutral",
      text: `Weight has held steady over the past month (${delta >= 0 ? "+" : ""}${delta} lb, two-week averages).`,
    };
  }
  return {
    key: "weight",
    tone: "neutral",
    text: `Weight is ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} lb over the past month (two-week averages), about ${round1(Math.abs(delta) / 4)} lb a week.`,
  };
}

function restingHeartRateNote(input: TrendNoteInput): TrendNote | null {
  const recentStart = addDays(input.today, -6);
  const baselineStart = addDays(input.today, -36);
  const values = (from: string, to: string) =>
    input.recovery
      .filter(
        (r) =>
          r.restingHeartRate != null &&
          r.checkinDate >= from &&
          r.checkinDate <= to,
      )
      .map((r) => r.restingHeartRate!);
  const recent = values(recentStart, input.today);
  const baseline = values(baselineStart, addDays(recentStart, -1));
  if (recent.length < 4 || baseline.length < 10) return null;
  const delta = Math.round(median(recent) - median(baseline));
  if (Math.abs(delta) < RHR_CHANGE_BPM) return null;
  return {
    key: "rhr",
    tone: delta < 0 ? "positive" : "attention",
    text:
      delta < 0
        ? `Resting heart rate is ${-delta} bpm below your usual this week.`
        : `Resting heart rate is ${delta} bpm above your usual this week. Illness, alcohol, heat or hard training can all do this.`,
  };
}

function minutesOfDay(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function wakeNote(input: TrendNoteInput): TrendNote | null {
  const start = addDays(input.today, -6);
  const wakes = input.recovery
    .filter(
      (r) =>
        r.wakeTimeLocal != null &&
        r.checkinDate >= start &&
        r.checkinDate <= input.today,
    )
    .map((r) => minutesOfDay(r.wakeTimeLocal!));
  if (wakes.length < 4) return null;
  const earliest = Math.min(...wakes);
  const latest = Math.max(...wakes);
  const spread = latest - earliest;
  const range = `${formatClock(earliest)} to ${formatClock(latest)}`;

  if (input.wakeTarget) {
    const target = minutesOfDay(input.wakeTarget);
    const onTarget = wakes.filter((w) => Math.abs(w - target) <= 30).length;
    return {
      key: "wake",
      tone: onTarget === wakes.length ? "positive" : "attention",
      text: `Up within 30 min of ${formatClock(target)} on ${onTarget} of ${wakes.length} days this week (${range}).`,
    };
  }
  return {
    key: "wake",
    tone: spread <= 60 ? "positive" : "attention",
    text: `Wake time ranged ${range} this week, a ${spread} min spread.`,
  };
}

export function buildTrendNotes(input: TrendNoteInput): TrendNote[] {
  const notes = [
    ...strengthNotes(input),
    cardioNote(input),
    restingHeartRateNote(input),
    wakeNote(input),
    weightNote(input),
  ].filter((n): n is TrendNote => n != null);
  return notes.slice(0, MAX_NOTES);
}
