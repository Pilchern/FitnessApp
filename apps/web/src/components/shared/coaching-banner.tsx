"use client";

import { useEffect, useState } from "react";
import type { RecoveryCoachingSuggestion } from "@fitness-app/application";

type CoachingBannerProps = {
  suggestion: RecoveryCoachingSuggestion;
  today: string;
};

export function CoachingBanner({ suggestion, today }: CoachingBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `coach_dismissed_${today}`;
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [today]);

  function dismiss() {
    localStorage.setItem(`coach_dismissed_${today}`, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const isWarning = suggestion.severity === "warning";

  const containerClass = isWarning
    ? "rounded-[1.75rem] border border-ember/20 bg-ember/5 p-5 shadow-panel"
    : "rounded-[1.75rem] border border-pine/20 bg-pine/5 p-5 shadow-panel";

  const iconClass = isWarning ? "text-ember" : "text-pine";
  const headlineClass = isWarning ? "text-ember" : "text-pine";
  const dismissClass = isWarning
    ? "rounded-full border border-ember/20 px-4 py-1.5 text-xs font-semibold text-ember transition hover:bg-ember/10"
    : "rounded-full border border-pine/20 px-4 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine/10";

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 text-xl leading-none ${iconClass}`} aria-hidden="true">
            {isWarning ? "⚡" : "💡"}
          </span>
          <div>
            <p className={`text-sm font-bold ${headlineClass}`}>{suggestion.headline}</p>
            <p className="mt-1 text-sm leading-6 text-ink/75">{suggestion.detail}</p>
          </div>
        </div>
        <button type="button" onClick={dismiss} className={dismissClass}>
          Got it
        </button>
      </div>
    </div>
  );
}
