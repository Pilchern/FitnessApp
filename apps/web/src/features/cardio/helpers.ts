import type {
  CardioSession,
  CardioTrainingTemplateDefinition,
  TrainingTemplate,
} from "@fitness-app/domain";
import type { CardioFormValues, CardioTemplatePreset } from "./types";

function isCardioDefinition(
  definition: TrainingTemplate["definition"],
): definition is CardioTrainingTemplateDefinition {
  return (
    typeof definition === "object" &&
    definition !== null &&
    "sessionKind" in definition &&
    typeof definition.sessionKind === "string"
  );
}

function buildIntervalStructure(definition: CardioTrainingTemplateDefinition) {
  if (
    definition.workIntervalMinutes != null &&
    definition.recoveryIntervalMinutes != null &&
    definition.rounds != null
  ) {
    return `${definition.rounds} x ${definition.workIntervalMinutes} min work / ${definition.recoveryIntervalMinutes} min recovery`;
  }

  return null;
}

export function buildCardioTemplatePresets(
  templates: TrainingTemplate[],
): CardioTemplatePreset[] {
  return templates
    .flatMap((template) => {
      if (template.templateType !== "cardio" || !isCardioDefinition(template.definition)) {
        return [];
      }

      return [
        {
          id: template.id,
          name: template.name,
          sessionKind: template.definition.sessionKind,
          targetDurationMinutes: template.definition.targetDurationMinutes ?? null,
          intervalStructure: buildIntervalStructure(template.definition),
          helperText: template.definition.notes ?? null,
        },
      ];
    });
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

export function toCardioFormValues(
  session: CardioSession | null,
): CardioFormValues {
  if (!session) {
    return {
      trainingTemplateId: "",
      sessionDate: todayIsoDate(),
      sessionKind: "zone2",
      plannedVsCompleted: "completed",
      durationMinutes: "",
      avgHeartRate: "",
      maxHeartRate: "",
      avgOutput: "",
      cadenceMin: "",
      cadenceMax: "",
      resistanceMin: "",
      resistanceMax: "",
      intervalStructure: "",
      rpe: "",
      notes: "",
    };
  }

  return {
    id: session.id,
    trainingTemplateId: session.trainingTemplateId ?? "",
    sessionDate: session.sessionDate,
    sessionKind: session.sessionKind,
    plannedVsCompleted: session.plannedVsCompleted,
    durationMinutes: numberToInput(session.durationMinutes),
    avgHeartRate: numberToInput(session.avgHeartRate),
    maxHeartRate: numberToInput(session.maxHeartRate),
    avgOutput: numberToInput(session.avgOutput),
    cadenceMin: numberToInput(session.cadenceMin),
    cadenceMax: numberToInput(session.cadenceMax),
    resistanceMin: numberToInput(session.resistanceMin),
    resistanceMax: numberToInput(session.resistanceMax),
    intervalStructure: session.intervalStructure ?? "",
    rpe: numberToInput(session.rpe),
    notes: session.notes ?? "",
  };
}

export function formatCardioDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatSessionKind(value: CardioSession["sessionKind"]) {
  switch (value) {
    case "zone2":
      return "Zone 2";
    case "vo2":
      return "VO2";
    case "recovery":
      return "Recovery";
    default:
      return "Other";
  }
}

const SPORT_TYPE_LABELS: Record<string, string> = {
  VirtualRide: "Indoor Ride",
  WeightTraining: "Strength",
  Workout: "Workout",
  Walk: "Walk",
  Run: "Run",
  Hike: "Hike",
  Swim: "Swim",
  Yoga: "Yoga",
  Pilates: "Pilates",
};

export function formatSportType(sportType: string): string {
  if (SPORT_TYPE_LABELS[sportType]) {
    return SPORT_TYPE_LABELS[sportType];
  }
  // Split PascalCase/camelCase into words
  return sportType.replace(/([A-Z])/g, " $1").trim();
}

export function formatCompletionLabel(value: CardioSession["plannedVsCompleted"]) {
  switch (value) {
    case "completed":
      return "Completed";
    case "partial":
      return "Partial";
    case "skipped":
      return "Skipped";
    default:
      return "Planned";
  }
}
