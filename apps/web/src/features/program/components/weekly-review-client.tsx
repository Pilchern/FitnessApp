"use client";

import { useState } from "react";

/** Copies the plain-text summary for the LifeOS Sunday review. */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={copy}
        className="h-11 w-full rounded-full bg-pine px-5 text-sm font-semibold text-white"
      >
        {copied === "done" ? "Copied" : "Copy summary"}
      </button>
      {copied === "failed" ? (
        <textarea
          readOnly
          value={text}
          aria-label="Summary text"
          className="min-h-48 w-full rounded-xl border border-ink/10 bg-white p-3 text-xs text-ink"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
