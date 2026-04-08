"use client";

import { useState } from "react";
import Link from "next/link";
import type { BodyMetric } from "@fitness-app/domain";
import { deleteBodyMetricAction } from "../actions";
import {
  formatBodyDate,
  formatBodyValue,
} from "../helpers";

const PAGE_SIZE = 12;

type BodyMetricListProps = {
  metrics: BodyMetric[];
};

export function BodyMetricList({ metrics }: BodyMetricListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? metrics : metrics.slice(0, PAGE_SIZE);

  if (metrics.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 p-8 text-center shadow-panel">
        <h2 className="font-display text-3xl text-ink">
          No measurements yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Log your weight and waist above. Body fat and muscle mass are optional.
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
            Recent measurements
          </h2>
        </div>
        <div className="text-sm text-ink/65">{metrics.length} total</div>
      </div>

      <div className="mt-5 space-y-4">
        {visible.map((metric) => (
          <article
            key={metric.id}
            className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink">
                    {formatBodyDate(metric.measuredOn)}
                  </h3>
                  {metric.source.sourceType === "imported" &&
                  metric.source.sourceProvider === "withings" ? (
                    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/65">
                      Withings
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/75">
                  <span>{`Weight ${formatBodyValue(metric.weightLb, "lb")}`}</span>
                  <span>{`Waist ${formatBodyValue(metric.waistIn, "in")}`}</span>
                  <span>{`Body fat ${formatBodyValue(metric.bodyFatPct, "%")}`}</span>
                  <span>{`Muscle ${formatBodyValue(metric.muscleMassLb, "lb")}`}</span>
                  {metric.fatFreeMassLb != null ? (
                    <span>{`Fat-free mass ${formatBodyValue(metric.fatFreeMassLb, "lb")}`}</span>
                  ) : null}
                  {metric.boneMassLb != null ? (
                    <span>{`Bone mass ${formatBodyValue(metric.boneMassLb, "lb")}`}</span>
                  ) : null}
                  {metric.hydrationPct != null ? (
                    <span>{`Hydration ${formatBodyValue(metric.hydrationPct, "%")}`}</span>
                  ) : null}
                  {metric.visceralFatIndex != null ? (
                    <span>{`Visceral fat ${metric.visceralFatIndex}`}</span>
                  ) : null}
                </div>

                {metric.notes ? (
                  <p className="text-sm leading-6 text-ink/75">{metric.notes}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/body?edit=${metric.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                >
                  Edit
                </Link>
                <form action={deleteBodyMetricAction}>
                  <input type="hidden" name="id" value={metric.id} />
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
        ))}
      </div>

      {metrics.length > PAGE_SIZE ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            {showAll ? "Show fewer" : `Show all ${metrics.length} measurements`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
