import Link from "next/link";
import type { WeeklyReview } from "@fitness-app/domain";

type ScoreHistoryCardProps = {
  reviews: WeeklyReview[];
};

function formatWeekRange(weekStart: string, weekEnd: string) {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(new Date(`${weekStart}T12:00:00`))} – ${fmt.format(new Date(`${weekEnd}T12:00:00`))}`;
}

function scoreBandStyles(band: string | undefined, totalScore: number | null) {
  if (totalScore == null || band == null) {
    return {
      bar: "bg-ink/10",
      badge: "border-ink/10 bg-white text-ink/50",
      label: "draft",
    };
  }
  if (band === "strong") {
    return {
      bar: "bg-pine",
      badge: "border-pine/20 bg-pine/10 text-pine",
      label: "Strong",
    };
  }
  if (band === "solid") {
    return {
      bar: "bg-amber-400",
      badge: "border-amber-300/40 bg-amber-50 text-amber-700",
      label: "Solid",
    };
  }
  return {
    bar: "bg-ember",
    badge: "border-ember/20 bg-ember/10 text-ember",
    label: "Fragile",
  };
}

export function ScoreHistoryCard({ reviews }: ScoreHistoryCardProps) {
  if (reviews.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/75 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Score history
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">No reviews yet</h2>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Complete a weekly review to start tracking your score over time.
        </p>
        <Link
          href="/weekly-review"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Start weekly review
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Score history
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Last {reviews.length} weeks</h2>
        </div>
        <Link
          href="/weekly-review"
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Open review
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {reviews.map((review) => {
          const totalScore = review.scoreDetails?.totalScore ?? null;
          const band = review.scoreDetails?.band;
          const styles = scoreBandStyles(band, totalScore);
          const pct = totalScore != null ? (totalScore / 100) * 100 : 0;

          return (
            <Link
              key={review.id}
              href={`/weekly-review?weekStart=${review.weekStart}`}
              className="flex items-center gap-4 rounded-[1.25rem] border border-ink/10 bg-sand/50 p-4 transition hover:border-pine/20 hover:bg-pine/5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-[0.16em] text-ink/60">
                  {formatWeekRange(review.weekStart, review.weekEnd)}
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full transition-all ${styles.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xl font-semibold text-ink">
                  {totalScore != null ? totalScore : "--"}
                </div>
                <div
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${styles.badge}`}
                >
                  {styles.label}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
