import { stepHabitThreshold } from "@fitness-app/application";
import { getDashboardData } from "@/features/dashboard/server";
import { routineForHabit } from "@/lib/routines";
import { SupplementChecklist } from "@/features/recovery/components/supplement-checklist";
import { logSupplementsAction } from "@/features/recovery/actions";
import { TodayCard } from "@/features/dashboard/components/today-card";
import { WeekPlanCard } from "@/features/dashboard/components/week-plan-card";
import { TrendNotesCard } from "@/features/dashboard/components/trend-notes-card";
import { BodySnapshotCard } from "@/features/dashboard/components/body-snapshot-card";
import { PeerFitnessCard } from "@/features/dashboard/components/peer-fitness-card";
import { StrainSleepCard } from "@/features/dashboard/components/strain-sleep-card";
import { getProgramToday } from "@/features/program/server";
import { getAdherenceSnapshot } from "@/features/program/weekly-server";
import { ProgramTodayCard } from "@/features/program/components/program-today-card";

/** The program card is additive: if it cannot load, the dashboard still does. */
async function loadProgramToday() {
  try {
    return await getProgramToday();
  } catch (error) {
    console.error("Program card failed to load", error);
    return null;
  }
}

async function loadAdherence() {
  try {
    return await getAdherenceSnapshot();
  } catch (error) {
    console.error("Adherence snapshot failed to load", error);
    return null;
  }
}

/**
 * Answers three questions top to bottom: what to do today (readiness, the
 * planned session, habits), how the week is going (plan, strain and sleep),
 * and what has changed (trend notes, body).
 */
export default async function DashboardPage() {
  const [data, programToday, adherence] = await Promise.all([
    getDashboardData(),
    loadProgramToday(),
    loadAdherence(),
  ]);
  const stepsToday = data.activity.stepsToday;
  const stepHabitNotes: Record<string, string> =
    stepsToday != null
      ? Object.fromEntries(
          data.habits.items
            .filter((h) => stepHabitThreshold(h.name) != null)
            .map((h) => [h.id, `${stepsToday.toLocaleString("en-US")} today`]),
        )
      : {};

  const routineLinks = Object.fromEntries(
    data.habits.items.flatMap((h) => {
      const routine = routineForHabit(h.name);
      return routine
        ? [[h.id, { href: `/routines/${routine.slug}`, label: "Guide" }]]
        : [];
    }),
  );

  const habits = (
    <SupplementChecklist
      supplements={data.habits.items}
      takenSupplementIds={data.habits.takenTodayIds}
      logDate={data.habits.logDate}
      returnTo="/dashboard"
      weekCounts={data.habits.weekCounts}
      itemNotes={stepHabitNotes}
      itemLinks={routineLinks}
      labels={{
        eyebrow: "Daily habits",
        title: "Today's habits",
        empty: "No habits yet.",
        hint: "Saves as you tap. The count is days done in the last 7.",
        save: "Save habits",
      }}
      action={logSupplementsAction}
    />
  );

  // Phone order: readiness, today's session, habits (tapped daily), the week,
  // then the slower-moving cards. Desktop pairs them in two columns.
  return (
    <div className="space-y-4 lg:space-y-6">
      <h1 className="sr-only">Dashboard</h1>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <TodayCard
          today={data.today}
          readiness={data.readiness}
          history={data.readinessHistory}
          call={data.readinessCall}
          // The program card carries Start lift / Log ride when it loads.
          todayItems={programToday ? [] : data.todayItems}
          feelToday={data.feelToday}
          stepsToday={stepsToday}
        />
        {programToday ? (
          <ProgramTodayCard today={programToday} snapshot={adherence} />
        ) : (
          habits
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {programToday ? habits : null}
        <div className="space-y-4 lg:space-y-6">
          <WeekPlanCard
            plan={data.weekPlan}
            zone2Minutes={data.zone2Minutes}
            latestReview={data.latestReview}
          />
          <StrainSleepCard data={data.strainSleep} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <TrendNotesCard notes={data.trendNotes} insights={data.topInsights} />
        <div className="space-y-4 lg:space-y-6">
          <BodySnapshotCard
            today={data.today}
            latestWeightLb={data.latestWeightLb}
            latestBodyFatPct={data.latestBodyFatPct}
            latestBodyDate={data.latestBodyDate}
            weeklyWeight={data.weeklyWeight}
            vo2Max={data.activity.vo2Max}
            proteinHit={data.proteinHit}
          />
          <PeerFitnessCard peerFitness={data.peerFitness} />
        </div>
      </div>
    </div>
  );
}
