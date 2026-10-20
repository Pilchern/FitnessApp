import type { IsoDate, TrainingProgram } from "@fitness-app/domain";
import { addDays } from "./program-calendar";
import { buildDayPlan, RIDE_KIND_LABEL } from "./program-plan";
import {
  DEFAULT_PROGRAM_SETTINGS,
  type ProgramSettings,
} from "./program-settings";

/** Offset of `timeZone` from UTC at `instant`, in minutes (Chicago CDT: -300). */
function offsetMinutes(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - instant) / 60000);
}

/** The UTC instant of wall-clock `hhmm` on `date` in `timeZone`, DST-aware. */
export function zonedTimeToUtc(date: IsoDate, hhmm: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, h!, min!);
  let instant = wall - offsetMinutes(wall, timeZone) * 60000;
  // Second pass settles a guess that landed on the other side of a DST switch.
  instant = wall - offsetMinutes(instant, timeZone) * 60000;
  return new Date(instant);
}

export type CalendarEvent = {
  uid: string;
  date: IsoDate;
  start: string;
  minutes: number;
  title: string;
  description: string;
};

/**
 * Planned lifts, rides and Sunday tests from `from` through `through`, at
 * the times in settings. Planned as if the knee check is normal; gated
 * sessions (walk-jog before the jog gate) are left out; a gated ride shows
 * as the Zone 2 ride it runs as.
 */
export function programCalendarEvents(
  program: TrainingProgram,
  from: IsoDate,
  through: IsoDate,
  settings: ProgramSettings = DEFAULT_PROGRAM_SETTINGS,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let date = from; date <= through; date = addDays(date, 1)) {
    const plan = buildDayPlan(program, date, null, settings);
    for (const planned of plan.sessions) {
      if (!planned.visible) continue;
      const s = planned.session;
      const timing =
        s.sessionType === "lift"
          ? [settings.calendarLiftTime, settings.calendarLiftMinutes]
          : s.sessionType === "peloton"
            ? [settings.calendarPelotonTime, settings.calendarPelotonMinutes]
            : s.sessionType === "test"
              ? [settings.calendarTestTime, settings.calendarTestMinutes]
              : s.sessionType === "run" || s.sessionType === "walk"
                ? [
                    settings.calendarPelotonTime,
                    settings.calendarPelotonMinutes,
                  ]
                : null;
      if (!timing) continue;
      const exercises = planned.exercises
        .filter((e) => e.status === "active" || e.status === "substitute")
        .map((e) => e.name);
      const ride = planned.ride
        ? [
            RIDE_KIND_LABEL[planned.ride.kind],
            planned.ride.minutesMin != null
              ? `${planned.ride.minutesMin}–${planned.ride.minutesMax} min`
              : null,
            planned.ride.structure,
          ]
            .filter(Boolean)
            .join(", ")
        : null;
      events.push({
        uid: `${date}-${s.id}@fitness-app`,
        date,
        start: timing[0] as string,
        minutes: timing[1] as number,
        title: `${planned.name} (wk ${plan.info.week})`,
        description: [ride, exercises.join(", ") || null, s.notes]
          .filter(Boolean)
          .join("\n"),
      });
    }
  }
  return events;
}

function icsStamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function icsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (RFC 5545 3.1). */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + len > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** An iCalendar file (times in UTC) for the events. */
export function toIcs(
  events: CalendarEvent[],
  timeZone: string,
  now: Date = new Date(),
  calendarName = "Training program",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FitnessApp//Program//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendarName)}`,
    ...events.flatMap((e) => {
      const start = zonedTimeToUtc(e.date, e.start, timeZone);
      const end = new Date(start.getTime() + e.minutes * 60000);
      return [
        "BEGIN:VEVENT",
        `UID:${e.uid}`,
        `DTSTAMP:${icsStamp(now)}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        `SUMMARY:${icsText(e.title)}`,
        e.description ? `DESCRIPTION:${icsText(e.description)}` : null,
        "END:VEVENT",
      ].filter((l): l is string => l != null);
    }),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
