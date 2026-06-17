"use client";

import { useState } from "react";
import type { PersistedInsight } from "@fitness-app/application";
import { DismissibleInsightCard } from "./dismissible-insight-card";

type Props = {
  initialInsights: PersistedInsight[];
};

export function InsightsList({ initialInsights }: Props) {
  const [insights, setInsights] = useState(initialInsights);

  function removeInsight(id: string) {
    setInsights((prev) => prev.filter((insight) => insight.id !== id));
  }

  if (insights.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-pine/30 bg-pine/5 p-8 text-center shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">All clear</p>
        <h2 className="mt-3 font-display text-3xl text-ink">No patterns to flag right now.</h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Keep logging and check back after your next week.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {insights.map((insight) => (
        <DismissibleInsightCard
          key={insight.id}
          insight={insight}
          onRemove={removeInsight}
        />
      ))}
    </section>
  );
}
