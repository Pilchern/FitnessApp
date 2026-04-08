"use client";

import { useState } from "react";
import Link from "next/link";
import type { NutritionLog } from "@fitness-app/domain";
import { deleteNutritionLogAction } from "../actions";
import {
  countAdherenceChecks,
  formatNutritionDate,
  totalPossibleChecks,
} from "../helpers";

const PAGE_SIZE = 14;

type NutritionLogListProps = {
  logs: NutritionLog[];
};

export function NutritionLogList({ logs }: NutritionLogListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? logs : logs.slice(0, PAGE_SIZE);

  if (logs.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 p-8 text-center shadow-panel">
        <h2 className="font-display text-3xl text-ink">
          No nutrition logs yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Start logging your daily nutrition checks to build a picture of your
          consistency over time.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            History
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            Recent nutrition logs
          </h2>
        </div>
        <div className="text-sm text-ink/65">{logs.length} total</div>
      </div>

      <div className="mt-5 space-y-4">
        {visible.map((log) => {
          const hit = countAdherenceChecks(log);
          const possible = totalPossibleChecks(log);

          return (
            <article
              key={log.id}
              className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-ink">
                    {formatNutritionDate(log.logDate)}
                  </h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/75">
                    <span>
                      {possible > 0
                        ? `${hit}/${possible} checks`
                        : "No checks logged"}
                    </span>
                    {log.alcoholCount > 0 ? (
                      <span>{`${log.alcoholCount} drink${log.alcoholCount === 1 ? "" : "s"}`}</span>
                    ) : null}
                    {log.proteinHit !== null && (
                      <span className={log.proteinHit ? "text-pine" : ""}>
                        {log.proteinHit ? "✓ Protein" : "Protein missed"}
                      </span>
                    )}
                    {log.fiberTaken !== null && (
                      <span className={log.fiberTaken ? "text-pine" : ""}>
                        {log.fiberTaken ? "✓ Fiber" : "No fiber"}
                      </span>
                    )}
                    {log.mealsOnPlan !== null && (
                      <span>{log.mealsOnPlan ? "Meals on plan" : "Meals off plan"}</span>
                    )}
                    {log.noPostDinnerSnacking !== null && (
                      <span>
                        {log.noPostDinnerSnacking
                          ? "No late snacking"
                          : "Late snacking"}
                      </span>
                    )}
                    {log.junkLeakage !== null && (
                      <span>
                        {log.junkLeakage ? "Junk leakage" : "No junk leakage"}
                      </span>
                    )}
                  </div>

                  {log.notes ? (
                    <p className="text-sm leading-6 text-ink/75">
                      {log.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/nutrition?edit=${log.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Edit
                  </Link>
                  <form action={deleteNutritionLogAction}>
                    <input type="hidden" name="id" value={log.id} />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {logs.length > PAGE_SIZE ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            {showAll ? "Show fewer" : `Show all ${logs.length} entries`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
