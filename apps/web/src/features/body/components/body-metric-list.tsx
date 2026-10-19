"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BodyMetric } from "@fitness-app/domain";
import { deleteBodyMetricAction } from "../actions";
import { formatBodyDate, formatBodyValue } from "../helpers";
import { useToast } from "@/components/shared/toast-provider";

const PAGE_SIZE = 12;

type BodyMetricListProps = {
  metrics: BodyMetric[];
  deleted?: boolean;
};

export function BodyMetricList({ metrics, deleted }: BodyMetricListProps) {
  const [showAll, setShowAll] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (deleted) {
      showToast("Entry deleted");
      const url = new URL(window.location.href);
      url.searchParams.delete("deleted");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
  }, [deleted, showToast, router]);
  const visible = showAll ? metrics : metrics.slice(0, PAGE_SIZE);

  if (metrics.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 py-12 shadow-panel">
        <div className="max-w-sm mx-auto text-center">
          <div className="text-4xl">⚖️</div>
          <h2 className="mt-4 font-display text-xl text-ink">
            No measurements yet
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Weigh-ins sync from Withings each day. They will show up here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg text-ink">History</h2>
        <div className="text-sm text-ink/55">{metrics.length} total</div>
      </div>

      {/* One row per day; tap for the full composition, edit and delete. */}
      <ul className="mt-3 divide-y divide-ink/10">
        {visible.map((metric) => {
          const summary = [
            metric.weightLb != null
              ? formatBodyValue(metric.weightLb, "lb")
              : null,
            metric.bodyFatPct != null
              ? formatBodyValue(metric.bodyFatPct, "%")
              : null,
            metric.waistIn != null
              ? `Waist ${formatBodyValue(metric.waistIn, "in")}`
              : null,
          ].filter(Boolean);
          const details = [
            metric.muscleMassLb != null
              ? `Muscle ${formatBodyValue(metric.muscleMassLb, "lb")}`
              : null,
            metric.fatFreeMassLb != null
              ? `Fat-free ${formatBodyValue(metric.fatFreeMassLb, "lb")}`
              : null,
            metric.boneMassLb != null
              ? `Bone ${formatBodyValue(metric.boneMassLb, "lb")}`
              : null,
            metric.hydrationPct != null
              ? `Hydration ${formatBodyValue(metric.hydrationPct, "%")}`
              : null,
            metric.visceralFatIndex != null
              ? `Visceral fat ${metric.visceralFatIndex}`
              : null,
            metric.waistHipIn != null
              ? `Waist (hip) ${formatBodyValue(metric.waistHipIn, "in")}`
              : null,
            metric.waistGutIn != null
              ? `Waist (gut) ${formatBodyValue(metric.waistGutIn, "in")}`
              : null,
          ].filter(Boolean);
          const fromWithings =
            metric.source.sourceType === "imported" &&
            metric.source.sourceProvider === "withings";

          return (
            <li key={metric.id}>
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
                  <span className="text-sm font-medium text-ink">
                    {formatBodyDate(metric.measuredOn)}
                  </span>
                  <span className="text-right text-sm text-ink/65">
                    {summary.length > 0 ? summary.join(" · ") : "No data"}
                  </span>
                </summary>
                <div className="space-y-3 pb-4 text-sm text-ink/70">
                  {details.length > 0 ? <p>{details.join(" · ")}</p> : null}
                  {metric.notes ? (
                    <p className="text-ink/80">{metric.notes}</p>
                  ) : null}
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/body?edit=${metric.id}`}
                      className="inline-flex min-h-10 items-center font-semibold text-pine hover:underline"
                    >
                      Edit
                    </Link>
                    <form
                      action={deleteBodyMetricAction}
                      onSubmit={(event) => {
                        if (!window.confirm("Delete this entry?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={metric.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center font-semibold text-ember hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                    {fromWithings ? (
                      <span className="ml-auto text-xs text-ink/45">
                        Withings
                      </span>
                    ) : null}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

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
