import type { StrengthSession } from "@fitness-app/domain";
import type { StrengthFormValues, StrengthSetFormValue } from "./types";

export function createEmptyStrengthSet(
  partial?: Partial<StrengthSetFormValue>,
): StrengthSetFormValue {
  return {
    exerciseName: partial?.exerciseName ?? "",
    setNumber: partial?.setNumber ?? 1,
    reps: partial?.reps ?? "",
    weight: partial?.weight ?? "",
    rir: partial?.rir ?? "",
    notes: partial?.notes ?? "",
  };
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberToInput(value: number | null) {
  return value == null ? "" : `${value}`;
}

export function toStrengthFormValues(
  session: StrengthSession | null,
): StrengthFormValues {
  if (!session) {
    return {
      sessionDate: todayIsoDate(),
      sessionName: "",
      notes: "",
      durationMinutes: "",
      readinessPre: "",
      energyPost: "",
      completedAsPlanned: true,
      sets: [createEmptyStrengthSet()],
    };
  }

  return {
    id: session.id,
    sessionDate: session.sessionDate,
    sessionName: session.sessionName ?? "",
    notes: session.notes ?? "",
    durationMinutes: numberToInput(session.durationMinutes),
    readinessPre: numberToInput(session.readinessPre),
    energyPost: numberToInput(session.energyPost),
    completedAsPlanned: session.completedAsPlanned,
    sets:
      session.sets.length > 0
        ? session.sets.map((set) => ({
            exerciseName: set.exerciseName,
            setNumber: set.setNumber,
            reps: numberToInput(set.reps),
            weight: numberToInput(set.weight),
            rir: numberToInput(set.rir),
            notes: set.notes ?? "",
          }))
        : [createEmptyStrengthSet()],
  };
}

export function formatStrengthDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatTopSet(weight: number | null, reps: number | null) {
  if (weight == null && reps == null) {
    return "--";
  }

  if (weight != null && reps != null) {
    return `${weight} x ${reps}`;
  }

  if (weight != null) {
    return `${weight} lb`;
  }

  return `${reps} reps`;
}
