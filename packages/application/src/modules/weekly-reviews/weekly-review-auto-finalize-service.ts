import type { WeeklyReview, WeeklyReviewSummary } from "@fitness-app/domain";
import { BodyMetricService } from "../body-metrics/body-metric";
import { CardioSessionService } from "../cardio/cardio-session";
import { JournalEntryService } from "../journal/journal-entry";
import { RecoveryCheckinService } from "../recovery/recovery-checkin";
import { StrengthSessionSummaryService } from "../strength/strength-session-summary";
import type { AiWeeklyReviewService } from "./ai-weekly-review-service";
import { WeeklyReviewService } from "./weekly-review";
import {
  buildWeeklyReviewSummary,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
} from "./weekly-review-helpers";

export type WeeklyReviewAutoFinalizeDependencies = {
  weeklyReviewService: WeeklyReviewService;
  journalService: JournalEntryService;
  bodyMetricService: BodyMetricService;
  cardioService: CardioSessionService;
  recoveryService: RecoveryCheckinService;
  strengthSummaryService: StrengthSessionSummaryService;
  /** null when ANTHROPIC_API_KEY isn't configured — AI drafting is skipped entirely. */
  aiWeeklyReviewService: AiWeeklyReviewService | null;
};

export type WeeklyReviewAutoFinalizeProfile = {
  userId: string;
  weekStartsOn: 0 | 1 | null;
};

export type WeeklyReviewAutoFinalizeOutcome =
  | { status: "drafted"; journalDrafted: boolean; aiDrafted: boolean }
  | { status: "skipped"; aiDrafted: boolean };

const monthAbbreviations = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDisplayDate(isoDate: string): string {
  const [, monthStr, dayStr] = isoDate.split("-");
  const month = monthAbbreviations[parseInt(monthStr, 10) - 1] ?? monthStr;
  const day = parseInt(dayStr, 10);
  return `${month} ${day}`;
}

/**
 * Orchestrates the weekly-review-auto-finalize cron's per-user work:
 * drafting the auto-computed weekly review, drafting a journal reflection
 * entry, and (if AI is configured) generating an AI review draft.
 *
 * This was previously inline in
 * apps/web/src/app/api/cron/weekly-review-auto-finalize/route.ts — moved
 * here so the domain logic is framework-free, testable in isolation, and
 * routed through the same composition root (createCoreServices) as every
 * other feature module, per the architecture agent's boundary rules
 * (business logic does not live in route handlers).
 */
export class WeeklyReviewAutoFinalizeService {
  constructor(private readonly deps: WeeklyReviewAutoFinalizeDependencies) {}

  /**
   * Runs the full auto-finalize flow for a single user's profile. Errors
   * from the primary draft step propagate to the caller (the cron route's
   * mapWithConcurrency wrapper is responsible for isolating per-user
   * failures); journal-draft and AI-draft failures are caught internally
   * and fail soft, matching the pre-extraction behavior exactly.
   */
  async finalizeForUser(
    profile: WeeklyReviewAutoFinalizeProfile,
  ): Promise<WeeklyReviewAutoFinalizeOutcome> {
    const draftResult = await this.draftReviewForUser(profile);

    if (draftResult.status === "skipped") {
      const aiDrafted = await this.maybeGenerateAiDraft(
        profile.userId,
        draftResult.review,
      );
      return { status: "skipped", aiDrafted };
    }

    let journalDrafted = false;
    try {
      await this.draftJournalEntryForUser(
        profile,
        draftResult.weekStart,
        draftResult.autoSummary,
      );
      journalDrafted = true;
    } catch (journalErr) {
      const message =
        journalErr instanceof Error ? journalErr.message : "Unknown error";
      console.error(
        `[WeeklyReviewAutoFinalizeService] Journal draft failed for user ${profile.userId}:`,
        message,
      );
    }

    const aiDrafted = await this.maybeGenerateAiDraft(
      profile.userId,
      draftResult.review,
    );

    return { status: "drafted", journalDrafted, aiDrafted };
  }

  private async maybeGenerateAiDraft(
    userId: string,
    review: WeeklyReview,
  ): Promise<boolean> {
    if (!this.deps.aiWeeklyReviewService) {
      return false;
    }

    return this.generateAiDraftForUser(
      userId,
      review,
      this.deps.aiWeeklyReviewService,
    );
  }

  private async draftReviewForUser(
    profile: WeeklyReviewAutoFinalizeProfile,
  ): Promise<
    | {
        status: "drafted";
        review: WeeklyReview;
        autoSummary: WeeklyReviewSummary;
        weekStart: string;
      }
    | { status: "skipped"; review: WeeklyReview }
  > {
    const weekStartsOn = (profile.weekStartsOn ?? 1) as 0 | 1;
    const prevWeekStartIso = getLastCompletedWeekStart(
      new Date(),
      weekStartsOn,
    );
    const { weekEnd: prevWeekEndIso } = getWeekRangeFromStart(prevWeekStartIso);

    const { weeklyReviewService } = this.deps;

    const existing = await weeklyReviewService.getByWeekStart({
      userId: profile.userId,
      weekStart: prevWeekStartIso,
    });

    if (existing) {
      return { status: "skipped" as const, review: existing };
    }

    const dateRangeQuery = {
      userId: profile.userId,
      startDate: prevWeekStartIso,
      endDate: prevWeekEndIso,
    };

    const [bodyMetrics, cardioSessions, recoveryCheckins, liftsCompleted] =
      await Promise.all([
        this.deps.bodyMetricService.listByDateRange(dateRangeQuery),
        this.deps.cardioService.listByDateRange(dateRangeQuery),
        this.deps.recoveryService.listByDateRange(dateRangeQuery),
        this.deps.strengthSummaryService.countCompletedByDateRange(
          dateRangeQuery,
        ),
      ]);

    const autoSummary = buildWeeklyReviewSummary({
      bodyMetrics,
      cardioSessions,
      recoveryCheckins,
      liftsCompleted,
    });

    const review = await weeklyReviewService.create({
      userId: profile.userId,
      weekStart: prevWeekStartIso,
      weekEnd: prevWeekEndIso,
      status: "draft",
      summary: autoSummary,
      bestWin: null,
      biggestMiss: null,
      lesson: null,
      nextWeekPriority: null,
      confidence: null,
      scoreDetails: null,
      strategicDecision: null,
      riskForecast: null,
      manualOverrides: {},
      aiDraft: null,
      aiDraftStatus: "none",
      completedAt: null,
    });

    return {
      status: "drafted" as const,
      review,
      autoSummary,
      weekStart: prevWeekStartIso,
    };
  }

  private async draftJournalEntryForUser(
    profile: WeeklyReviewAutoFinalizeProfile,
    prevWeekStartIso: string,
    autoSummary: WeeklyReviewSummary,
  ): Promise<void> {
    const { journalService } = this.deps;
    const title = `Week of ${formatDisplayDate(prevWeekStartIso)}`;

    const existing = await journalService.listEntries({
      userId: profile.userId,
      startDate: prevWeekStartIso,
      endDate: prevWeekStartIso,
      tag: "weekly-reflection",
    });

    if (existing.some((e) => e.title === title)) return;

    const { weekEnd } = getWeekRangeFromStart(prevWeekStartIso);
    const lifts = autoSummary.liftsCompleted ?? 0;
    const cardio = autoSummary.ridesCompleted ?? 0;
    const sleepAvg =
      autoSummary.sleepAverageHours != null
        ? autoSummary.sleepAverageHours.toFixed(1)
        : "—";
    const readinessAvg = "—";

    const body = `Weekly reflection — ${formatDisplayDate(prevWeekStartIso)} to ${formatDisplayDate(weekEnd)}

This week: ${lifts} strength session${lifts !== 1 ? "s" : ""}, ${cardio} cardio session${cardio !== 1 ? "s" : ""}.
Avg readiness: ${readinessAvg}/10. Sleep avg: ${sleepAvg} hrs.

What went well?

What would I do differently?

One thing to focus on next week:`;

    await journalService.create({
      userId: profile.userId,
      entryDate: prevWeekStartIso,
      title,
      body,
      tags: ["weekly-reflection"],
      relatedWeekStart: prevWeekStartIso,
    });
  }

  /**
   * Generates and persists an AI weekly review draft for a single user's
   * review row, additive to the auto-finalize behavior above. Fails soft:
   * any error (Anthropic API, malformed response, or the persistence write
   * itself) is logged and the row is left with ai_draft_status = 'none' so
   * a later cron run retries it — never a half-set draft.
   *
   * Only fires for rows in status "draft" with ai_draft_status "none" —
   * reviews that already have a draft (pending_review/accepted/dismissed)
   * or are already completed are left untouched.
   */
  private async generateAiDraftForUser(
    userId: string,
    review: WeeklyReview,
    aiService: AiWeeklyReviewService,
  ): Promise<boolean> {
    if (review.status !== "draft" || review.aiDraftStatus !== "none") {
      return false;
    }

    try {
      const draft = await aiService.generateDraft({
        weekStart: review.weekStart,
        weekEnd: review.weekEnd,
        summary: review.summary,
      });

      if (!draft) {
        return false;
      }

      await this.deps.weeklyReviewService.saveAiDraft(userId, review.id, draft);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[WeeklyReviewAutoFinalizeService] AI draft generation failed for user ${userId}:`,
        message,
      );
      return false;
    }
  }
}
