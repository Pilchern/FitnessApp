import Link from "next/link";
import { CoachingBanner } from "@/components/shared/coaching-banner";
import { InsightCard } from "@/components/shared/insight-card";
import { WeeklyReviewSummaryCard } from "@/components/shared/weekly-review-summary-card";
import { getDashboardData } from "@/features/dashboard/server";
import { TrainingWeekCard } from "@/features/dashboard/components/training-week-card";
import { RecoverySnapshotCard } from "@/features/dashboard/components/recovery-snapshot-card";
import { BodySnapshotCard } from "@/features/dashboard/components/body-snapshot-card";
import { ScoreHistoryCard } from "@/features/dashboard/components/score-history-card";
import { NutritionSnapshotCard } from "@/features/dashboard/components/nutrition-snapshot-card";
import { GoalProgressCard } from "@/features/dashboard/components/goal-progress-card";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {data.coachingSuggestion && (
        <CoachingBanner suggestion={data.coachingSuggestion} today={today} />
      )}

      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
              This week
            </p>
            <h1 className="mt-3 font-display text-2xl md:text-4xl text-ink">Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
              Your training, recovery, and body at a glance.
            </p>
          </div>
          {data.journalStreak >= 2 ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-pine/20 bg-pine/10 px-4 py-2 text-sm font-semibold text-pine">
              🔥 {data.journalStreak} day streak
            </span>
          ) : null}
        </div>
      </section>

      <TrainingWeekCard data={data.trainingWeek} />

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <RecoverySnapshotCard latestRecovery={data.latestRecovery} />
        <BodySnapshotCard
          latestWeightLb={data.latestWeightLb}
          weightChangeLb={data.weightChangeLb}
          latestWaistIn={data.latestWaistIn}
          waistChangeIn={data.waistChangeIn}
          latestBodyFatPct={data.latestBodyFatPct}
          latestBodyDate={data.latestBodyDate}
          weightTrend={data.weightTrend}
        />
      </div>

      <GoalProgressCard goalProgress={data.goalProgress} />

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <WeeklyReviewSummaryCard
          review={data.latestReview}
          emptyTitle="No weekly review yet"
          emptyDescription="Complete your first weekly review to start tracking your score over time."
        />
        <ScoreHistoryCard reviews={data.recentReviews} />
      </div>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
        <NutritionSnapshotCard
          todayNutrition={data.todayNutrition}
          nutritionTargets={data.nutritionTargets}
        />
      </div>

      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
              Coaching
            </p>
            <h2 className="mt-3 font-display text-2xl text-ink">Insights</h2>
          </div>
          <Link
            href="/insights"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            Open all insights
          </Link>
        </div>

        {data.topInsights.length === 0 ? (
          <p className="mt-5 text-sm leading-6 text-ink/75">
            No insights yet. Keep logging your workouts and recovery — they&apos;ll appear here as patterns emerge.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {data.topInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
