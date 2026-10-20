import type { WeeklyReview } from "@fitness-app/domain";
import { BodyMetricService } from "../body-metrics/body-metric";
import { CardioSessionService } from "../cardio/cardio-session";
import { RecoveryCheckinService } from "../recovery/recovery-checkin";
import { StrengthSessionSummaryService } from "../strength/strength-session-summary";
import type { SupplementLogService } from "../supplements/supplement-log-repository";
import type { SupplementService } from "../supplements/supplement-repository";
import type { ProgramService } from "../program/program-service";
import type { TrainingTemplateService } from "../training/training-template";
import {
  buildPlanAdherence,
  loadWeekSchedule,
  type PlanAdherence,
} from "./plan-adherence";
import type { AiWeeklyReviewService } from "./ai-weekly-review-service";
import { WeeklyReviewService } from "./weekly-review";
import {
  buildWeeklyReviewSummary,
  getLastCompletedWeekStart,
  getWeekRangeFromStart,
} from "./weekly-review-helpers";

export type WeeklyReviewAutoFinalizeDependencies = {
  weeklyReviewService: WeeklyReviewService;
  bodyMetricService: BodyMetricService;
  cardioService: CardioSessionService;
  recoveryService: RecoveryCheckinService;
  strengthSummaryService: StrengthSessionSummaryService;
  /** Optional: when present the draft summary carries plan adherence. */
  trainingTemplateService?: TrainingTemplateService;
  /**
   * The schedule and Zone 2 target come from the active program; without it
   * (or for a week no program block covers) the templates are the fallback.
   */
  programService?: ProgramService;
  supplementService?: SupplementService;
  supplementLogService?: SupplementLogService;
  /** null when ANTHROPIC_API_KEY isn't configured — AI drafting is skipped entirely. */
  aiWeeklyReviewService: AiWeeklyReviewService | null;
};

export type WeeklyReviewAutoFinalizeProfile = {
  userId: string;
  weekStartsOn: 0 | 1 | null;
};

export type WeeklyReviewAutoFinalizeOutcome =
  | { status: "drafted"; aiDrafted: boolean }
  | { status: "skipped"; aiDrafted: boolean };

/**
 * Orchestrates the weekly-review-auto-finalize cron's per-user work:
 * drafting the auto-computed weekly review and (if AI is configured)
 * generating an AI review draft.
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
   * failures); AI-draft failures are caught internally and fail soft,
   * matching the pre-extraction behavior exactly.
   */
  async finalizeForUser(
    profile: WeeklyReviewAutoFinalizeProfile,
  ): Promise<WeeklyReviewAutoFinalizeOutcome> {
    const draftResult = await this.draftReviewForUser(profile);
    const aiDrafted = await this.maybeGenerateAiDraft(
      profile.userId,
      draftResult.review,
    );
    return { status: draftResult.status, aiDrafted };
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
    | { status: "drafted"; review: WeeklyReview }
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
      adherence: await this.loadPlanAdherence(dateRangeQuery),
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

    return { status: "drafted" as const, review };
  }

  private async loadPlanAdherence(query: {
    userId: string;
    startDate: string;
    endDate: string;
  }): Promise<PlanAdherence | undefined> {
    const { trainingTemplateService, supplementService, supplementLogService } =
      this.deps;
    if (!trainingTemplateService || !supplementService || !supplementLogService)
      return undefined;
    try {
      const [schedule, supplements, habitLogs] = await Promise.all([
        loadWeekSchedule(
          { programService: this.deps.programService, trainingTemplateService },
          query,
        ),
        supplementService.listActive({ userId: query.userId }),
        supplementLogService.listByDateRange(query),
      ]);
      return buildPlanAdherence({
        schedule,
        habitIds: supplements
          .filter((s) => s.kind === "habit")
          .map((s) => s.id),
        habitLogs,
      });
    } catch (error) {
      console.error(
        "[WeeklyReviewAutoFinalizeService] plan adherence unavailable:",
        error instanceof Error ? error.message : error,
      );
      return undefined;
    }
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
