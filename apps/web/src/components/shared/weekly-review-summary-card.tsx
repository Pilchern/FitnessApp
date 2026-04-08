import Link from "next/link";
import type { WeeklyReview } from "@fitness-app/domain";

type WeeklyReviewSummaryCardProps = {
  review: WeeklyReview | null;
  href?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatWeekRange(weekStart: string, weekEnd: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(new Date(`${weekStart}T12:00:00`))} - ${formatter.format(
    new Date(`${weekEnd}T12:00:00`),
  )}`;
}

function scoreTone(totalScore: number | null) {
  if (totalScore == null) {
    return "border-ink/10 bg-white text-ink/70";
  }

  if (totalScore >= 85) {
    return "border-pine/20 bg-pine/10 text-pine";
  }

  if (totalScore >= 70) {
    return "border-amber-300/40 bg-amber-50 text-amber-700";
  }

  return "border-ember/20 bg-ember/10 text-ember";
}

export function WeeklyReviewSummaryCard({
  review,
  href = "/weekly-review",
  emptyTitle = "No weekly review yet",
  emptyDescription = "Complete your first weekly review to start tracking your score.",
}: WeeklyReviewSummaryCardProps) {
  if (!review) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/75 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Latest weekly review
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">{emptyTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">{emptyDescription}</p>
        <Link
          href={href}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Open weekly review
        </Link>
      </section>
    );
  }

  const totalScore = review.scoreDetails?.totalScore ?? null;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Latest weekly review
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            {formatWeekRange(review.weekStart, review.weekEnd)}
          </h2>
        </div>
        <div
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${scoreTone(totalScore)}`}
        >
          {totalScore != null ? `${totalScore}/100` : review.status}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Rating</div>
          <div className="mt-2 text-xl font-semibold capitalize text-ink">
            {review.scoreDetails?.band ?? "Draft"}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">Priority</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-ink">
            {review.nextWeekPriority ?? "Not set"}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-ink/10 bg-sand/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Confidence
          </div>
          <div className="mt-2 text-xl font-semibold text-ink">
            {review.confidence != null ? `${review.confidence}/10` : "--"}
          </div>
        </div>
      </div>

      {review.strategicDecision ? (
        <p className="mt-5 text-sm leading-6 text-ink/75">
          {review.strategicDecision}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Link
          href={`${href}?weekStart=${review.weekStart}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Open review
        </Link>
      </div>
    </section>
  );
}
