"use client";

import { useState, useTransition } from "react";
import { InsightCard } from "@/components/shared/insight-card";
import type { PersistedInsight } from "@fitness-app/application";
import { dismissInsightAction, archiveInsightAction } from "../actions";

type Props = {
  insight: PersistedInsight;
  onRemove: (id: string) => void;
};

const controlButtonClassName =
  "rounded-full border border-ink/15 bg-white/90 px-3 py-1 text-xs font-semibold text-ink/60 transition hover:border-ink/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export function DismissibleInsightCard({ insight, onRemove }: Props) {
  const [isPendingDismiss, startDismiss] = useTransition();
  const [isPendingArchive, startArchive] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDismiss() {
    setError(null);
    startDismiss(async () => {
      const result = await dismissInsightAction(insight.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onRemove(insight.id);
    });
  }

  function handleArchive() {
    setError(null);
    startArchive(async () => {
      const result = await archiveInsightAction(insight.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onRemove(insight.id);
    });
  }

  return (
    <div>
      <InsightCard insight={insight} />

      {error ? (
        <div className="mt-2 rounded-2xl border border-ember/20 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
        </div>
      ) : null}

      {/* Always visible (not hover-only) so the controls are reachable on
          touch devices, which have no hover state. */}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPendingDismiss || isPendingArchive}
          className={controlButtonClassName}
        >
          {isPendingDismiss ? "Dismissing..." : "Dismiss"}
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={isPendingDismiss || isPendingArchive}
          className={controlButtonClassName}
        >
          {isPendingArchive ? "Archiving..." : "Archive"}
        </button>
      </div>
    </div>
  );
}
