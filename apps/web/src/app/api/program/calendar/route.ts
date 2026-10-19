import {
  addDays,
  programCalendarEvents,
  programWeekInfo,
  toIcs,
  weekDateRange,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { getCachedUserProfile } from "@/lib/server/services";
import { loadProgramContext } from "@/features/program/server";

export const dynamic = "force-dynamic";

const MAX_DAYS = 16 * 7;

/**
 * Planned lifts, rides and Sunday tests from today through the end of the
 * current block, as an .ics file (times from Settings, in the profile's
 * timezone). Download it, or subscribe to this URL in a calendar app.
 */
export async function GET() {
  try {
    const ctx = await loadProgramContext();
    if (!ctx) {
      return new Response("No active program.", { status: 404 });
    }
    const user = await requireCurrentUser();
    const profile = await getCachedUserProfile(user.id);
    const { program, settings, today } = ctx;
    const block = programWeekInfo(program, today).block;
    // Through the end of the current block, at most 16 weeks out (the
    // return-to-sport block runs open-ended).
    const blockEnd = block
      ? weekDateRange(program.weekAnchorDate, block.endWeek).end
      : today;
    const cap = addDays(today, MAX_DAYS);
    const through = blockEnd < cap ? blockEnd : cap;
    const events = programCalendarEvents(program, today, through, settings);
    const body = toIcs(
      events,
      profile?.timezone || "UTC",
      new Date(),
      `${program.name} program`,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="training-program.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Calendar export failed", error);
    return new Response("Calendar export failed.", { status: 500 });
  }
}
