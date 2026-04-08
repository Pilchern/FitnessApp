import type {
  CardioTrainingTemplateDefinition,
  CardioSession,
  CardioSessionCompletion,
  CardioSessionKind,
  IsoDate,
  TrainingTemplate,
} from "@fitness-app/domain";

export type CardioWeeklyTotals = {
  completedSessions: number;
  totalMinutes: number;
  zone2Minutes: number;
  vo2Sessions: number;
  averageHeartRate: number | null;
};

export type CardioAdherenceStatus = "completed" | "skipped" | "due" | "pending";

export type CardioAdherenceItem = {
  key: string;
  label: string;
  targetDate: IsoDate;
  sessionKind: CardioSessionKind;
  status: CardioAdherenceStatus;
  templateId: string | null;
  loggedSessionId: string | null;
};

export type CardioAdherenceSummary = {
  items: CardioAdherenceItem[];
  completedCount: number;
  expectedCount: number;
};

const completionCountsAsDone = new Set<CardioSessionCompletion>([
  "completed",
  "partial",
]);

const supportedSchedule = [
  {
    key: "tuesday-zone2",
    label: "Tuesday Zone 2",
    weekdayOffset: 1,
    sessionKind: "zone2" as const,
  },
  {
    key: "thursday-vo2",
    label: "Thursday VO2",
    weekdayOffset: 3,
    sessionKind: "vo2" as const,
  },
  {
    key: "saturday-long-zone2",
    label: "Saturday Long Zone 2",
    weekdayOffset: 5,
    sessionKind: "zone2" as const,
  },
] as const;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(input: Date, days: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

function normalizeTemplateName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

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

function findTemplateForScheduleItem(
  scheduleItem: (typeof supportedSchedule)[number],
  templates: TrainingTemplate[],
) {
  const label = normalizeTemplateName(scheduleItem.label);
  return (
    templates.find((template) => normalizeTemplateName(template.name) === label) ??
    templates.find(
      (template) =>
        isCardioDefinition(template.definition) &&
        template.definition.sessionKind === scheduleItem.sessionKind,
    ) ??
    null
  );
}

export function getCurrentWeekRange(now = new Date()) {
  const start = startOfWeekMonday(now);
  const end = addDays(start, 6);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function buildCardioWeeklyTotals(
  sessions: CardioSession[],
): CardioWeeklyTotals {
  const completedSessions = sessions.filter((session) =>
    completionCountsAsDone.has(session.plannedVsCompleted),
  );

  const totalMinutes = completedSessions.reduce(
    (sum, session) => sum + (session.durationMinutes ?? 0),
    0,
  );

  const zone2Minutes = completedSessions.reduce((sum, session) => {
    if (session.sessionKind !== "zone2") {
      return sum;
    }

    return sum + (session.zone2Minutes ?? session.durationMinutes ?? 0);
  }, 0);

  const heartRateSamples = completedSessions
    .map((session) => session.avgHeartRate)
    .filter((value): value is number => value != null);

  const averageHeartRate =
    heartRateSamples.length > 0
      ? Math.round(
          heartRateSamples.reduce((sum, value) => sum + value, 0) /
            heartRateSamples.length,
        )
      : null;

  return {
    completedSessions: completedSessions.length,
    totalMinutes,
    zone2Minutes,
    vo2Sessions: completedSessions.filter((session) => session.sessionKind === "vo2")
      .length,
    averageHeartRate,
  };
}

export function buildCardioAdherenceSummary(
  sessions: CardioSession[],
  templates: TrainingTemplate[],
  now = new Date(),
): CardioAdherenceSummary {
  const weekStart = startOfWeekMonday(now);
  const today = toIsoDate(now);

  const items = supportedSchedule.map((scheduleItem) => {
    const targetDate = toIsoDate(addDays(weekStart, scheduleItem.weekdayOffset));
    const matchedTemplate = findTemplateForScheduleItem(scheduleItem, templates);
    const loggedSession =
      sessions.find(
        (session) =>
          session.sessionDate === targetDate &&
          ((matchedTemplate && session.trainingTemplateId === matchedTemplate.id) ||
            session.sessionKind === scheduleItem.sessionKind),
      ) ?? null;

    let status: CardioAdherenceStatus = "pending";

    if (loggedSession) {
      status = completionCountsAsDone.has(loggedSession.plannedVsCompleted)
        ? "completed"
        : loggedSession.plannedVsCompleted === "skipped"
          ? "skipped"
          : targetDate <= today
            ? "due"
            : "pending";
    } else if (targetDate <= today) {
      status = "due";
    }

    return {
      key: scheduleItem.key,
      label: scheduleItem.label,
      targetDate,
      sessionKind: scheduleItem.sessionKind,
      status,
      templateId: matchedTemplate?.id ?? null,
      loggedSessionId: loggedSession?.id ?? null,
    };
  });

  return {
    items,
    completedCount: items.filter((item) => item.status === "completed").length,
    expectedCount: items.filter((item) => item.targetDate <= today).length,
  };
}
