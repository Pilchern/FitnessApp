"use client";

import { useActionState } from "react";
import type { WeeklyReviewAiDraft } from "@fitness-app/domain";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import {
  dismissAiWeeklyReviewDraftAction,
  useAiWeeklyReviewDraftAction,
} from "../actions";
import type { WeeklyReviewActionState } from "../types";

type AiWeeklyReviewDraftProps = {
  draft: WeeklyReviewAiDraft;
  reviewId: string;
  weekStart: string;
};

const initialState: WeeklyReviewActionState = {};

type BlockProps = {
  label: string;
  value: string;
  tone?: "default" | "ember" | "pine";
};

function DraftBlock({ label, value, tone = "default" }: BlockProps) {
  const toneClass =
    tone === "ember"
      ? "border-ember/20 bg-ember/10"
      : tone === "pine"
        ? "border-pine/20 bg-pine/10"
        : "border-ink/10 bg-white/70";

  return (
    <div className={`rounded-[1.25rem] border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}

export function AiWeeklyReviewDraft({ draft, reviewId, weekStart }: AiWeeklyReviewDraftProps) {
  const [acceptState, acceptAction] = useActionState(
    useAiWeeklyReviewDraftAction,
    initialState,
  );
  const [dismissState, dismissAction] = useActionState(
    dismissAiWeeklyReviewDraftAction,
    initialState,
  );

  const error = acceptState.error ?? dismissState.error;

  return (
    <section className="space-y-5 rounded-[1.75rem] border border-pine/20 bg-pine/5 p-6 shadow-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            AI draft — awaiting your review
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            A first pass at this week&apos;s review
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
            Generated from your logged data. Nothing here is saved until you
            use it and submit the form below — review it like you would a
            draft from a coach.
          </p>
        </div>
        <div className="shrink-0 rounded-[1.25rem] border border-pine/25 bg-white/80 px-5 py-3 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
            AI score
          </div>
          <div className="mt-1 font-display text-3xl text-ink">{draft.score}</div>
          <div className="text-[11px] text-ink/50">out of 100 · informational only</div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <DraftBlock label="Why this score" value={draft.scoreRationale} />
        <DraftBlock label="What worked" value={draft.whatWorked} tone="pine" />
        <DraftBlock label="What needs attention" value={draft.whatNeedsAttention} tone="ember" />
        <DraftBlock label="Next best action" value={draft.nextBestAction} />
        <DraftBlock label="Strategic decision" value={draft.strategicDecision} />
        <DraftBlock label="Risk forecast (2-3 weeks)" value={draft.riskForecast} tone="ember" />
      </div>

      <div className="text-[11px] text-ink/40">
        Generated {new Date(draft.generatedAt).toLocaleString()} · {draft.model}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-pine/15 pt-4">
        <form action={acceptAction}>
          <input type="hidden" name="id" value={reviewId} />
          <input type="hidden" name="weekStart" value={weekStart} />
          <AuthSubmitButton idleLabel="Use this draft" pendingLabel="Applying..." />
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="id" value={reviewId} />
          <input type="hidden" name="weekStart" value={weekStart} />
          <ActionSubmitButton
            idleLabel="Dismiss"
            pendingLabel="Dismissing..."
            tone="secondary"
          />
        </form>
      </div>
    </section>
  );
}
