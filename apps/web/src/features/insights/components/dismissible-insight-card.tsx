"use client";

import { useTransition } from "react";
import { InsightCard } from "@/components/shared/insight-card";
import type { PersistedInsight } from "@fitness-app/application";
import { dismissInsightAction, archiveInsightAction } from "../actions";

type Props = {
  insight: PersistedInsight;
  onRemove: (id: string) => void;
};

export function DismissibleInsightCard({ insight, onRemove }: Props) {
  const [isPendingDismiss, startDismiss] = useTransition();
  const [isPendingArchive, startArchive] = useTransition();

  function handleDismiss() {
    startDismiss(async () => {
      await dismissInsightAction(insight.id);
      onRemove(insight.id);
    });
  }

  function handleArchive() {
    startArchive(async () => {
      await archiveInsightAction(insight.id);
      onRemove(insight.id);
    });
  }

  return (
    <div className="group relative">
      <InsightCard insight={insight} />
      <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPendingDismiss || isPendingArchive}
          className="rounded-full border border-ink/15 bg-white/90 px-3 py-1 text-xs font-semibold text-ink/60 transition hover:border-ink/30 hover:text-ink disabled:opacity-40"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={isPendingDismiss || isPendingArchive}
          className="rounded-full border border-ink/15 bg-white/90 px-3 py-1 text-xs font-semibold text-ink/60 transition hover:border-ink/30 hover:text-ink disabled:opacity-40"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
