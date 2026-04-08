import type { CardioSession, JournalEntry } from "@fitness-app/domain";
import { formatSportType } from "@/features/cardio/helpers";
import type { JournalFormValues } from "./types";

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toJournalFormValues(entry: JournalEntry | null): JournalFormValues {
  if (!entry) {
    return {
      entryDate: todayIsoDate(),
      title: "",
      body: "",
      tags: "",
      relatedWeekStart: "",
      relatedCardioSessionId: "",
      relatedStrengthSessionId: "",
    };
  }

  return {
    id: entry.id,
    entryDate: entry.entryDate,
    title: entry.title ?? "",
    body: entry.body,
    tags: entry.tags.join(", "),
    relatedWeekStart: entry.relatedWeekStart ?? "",
    relatedCardioSessionId: entry.relatedCardioSessionId ?? "",
    relatedStrengthSessionId: entry.relatedStrengthSessionId ?? "",
  };
}

export function formatJournalDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function summarizeBody(value: string, length = 180) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trimEnd()}...`;
}

export function formatCardioLinkLabel(session: CardioSession) {
  const typeLabel = session.sportType
    ? formatSportType(session.sportType)
    : session.sessionKind === "zone2"
      ? "Zone 2"
      : session.sessionKind === "vo2"
        ? "VO2"
        : session.sessionKind === "recovery"
          ? "Recovery"
          : "Workout";

  return `${formatJournalDate(session.sessionDate)} · ${typeLabel}`;
}
