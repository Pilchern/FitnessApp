import { MethodNote } from "@/components/shared/method-note";
import Link from "next/link";
import type { PeerFitness } from "@fitness-app/application";

type PeerFitnessCardProps = {
  peerFitness: PeerFitness;
};

function bandColor(percentile: number) {
  if (percentile >= 70) return "bg-pine";
  if (percentile >= 40) return "bg-amber-400";
  return "bg-ember";
}

/**
 * Fitness level against people of the same age and sex. Separate from
 * readiness on purpose: this moves over months, not days.
 */
export function PeerFitnessCard({ peerFitness }: PeerFitnessCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Fitness vs peers
      </p>

      {peerFitness.status === "needsProfile" ? (
        <p className="mt-3 text-sm text-ink/70">
          Add your {peerFitness.missing.join(" and ")} in{" "}
          <Link href="/settings" className="font-semibold text-pine">
            Settings
          </Link>{" "}
          to compare against people your age.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-4">
            {peerFitness.markers.map((m) => (
              <li key={m.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{m.label}</span>
                  <span className="font-semibold text-ink">
                    {m.value} {m.unit}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10"
                  role="img"
                  aria-label={`${m.rank.percentile}th percentile`}
                >
                  <div
                    className={`h-full rounded-full ${bandColor(m.rank.percentile)}`}
                    style={{ width: `${m.rank.percentile}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink/60">
                  {m.summary}
                  {m.next ? ` · ${m.next}` : null}
                </p>
              </li>
            ))}
            {peerFitness.pending.map((p) => (
              <li key={p.key} className="text-sm">
                <span className="text-ink">{p.label}</span>
                <p className="mt-0.5 text-xs text-ink/60">{p.hint}</p>
              </li>
            ))}
          </ul>
          <MethodNote label="Sources">
            VO2 max against FRIEND treadmill norms (Kaminsky 2022) for{" "}
            {peerFitness.ageBand}; resting HR against 92,457 wearable users
            (Quer 2020), by sex only. Apple Watch VO2 max is itself an estimate.
          </MethodNote>
        </>
      )}
    </section>
  );
}
