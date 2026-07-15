-- AI-generated weekly review draft: two new nullable columns on the
-- existing weekly_reviews row (1:1 with the review, not a separate table).
--
-- Design decision: keep the AI's output entirely separate from the canonical
-- best_win / biggest_miss / lesson / strategic_decision / risk_forecast /
-- next_week_priority columns. Nothing about the "real" weekly review changes
-- until the user explicitly reviews and accepts the draft in the UI — this
-- makes "not an auto-committed review" true at the data layer, not just the
-- UI layer.
--
-- ai_draft is jsonb (not 7 separate columns) because it is one cohesive
-- generated artifact — edited and accepted/discarded as a single unit by the
-- user, not queried field-by-field the way e.g. supplement adherence needs
-- to be. Shape (enforced in the application layer via Zod, not here):
--   {
--     "score": number (1-100),
--     "scoreRationale": string,
--     "whatWorked": string,
--     "whatNeedsAttention": string,
--     "strategicDecision": string,
--     "riskForecast": string,
--     "nextBestAction": string,
--     "model": string,
--     "generatedAt": string (ISO datetime)
--   }
--
-- ai_draft_status tracks the review lifecycle of that draft independent of
-- the review's own draft/completed status:
--   none           -> never generated, or generation failed/was skipped
--   pending_review -> generated, waiting for the user to accept or dismiss
--   accepted        -> user copied the draft into the real fields
--   dismissed       -> user discarded the draft without using it

alter table public.weekly_reviews
  add column if not exists ai_draft jsonb,
  add column if not exists ai_draft_status text not null default 'none';

alter table public.weekly_reviews
  drop constraint if exists weekly_reviews_ai_draft_status_check;

alter table public.weekly_reviews
  add constraint weekly_reviews_ai_draft_status_check
  check (ai_draft_status in ('none', 'pending_review', 'accepted', 'dismissed'));

comment on column public.weekly_reviews.ai_draft is
  'AI-generated weekly review draft (score, rationale, what worked/needs attention, strategic decision, risk forecast, next best action, model, generatedAt). Entirely separate from the canonical review fields until the user accepts it via the weekly-review UI.';

comment on column public.weekly_reviews.ai_draft_status is
  'Lifecycle of the AI draft: none (not generated / generation skipped or failed), pending_review (generated, awaiting user action), accepted (copied into real fields), dismissed (discarded).';
