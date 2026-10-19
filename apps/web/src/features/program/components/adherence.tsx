import Link from "next/link";
import type { WeekAdherence } from "@fitness-app/application";
import type { AdherenceSnapshot } from "../types";
import { ratioTone } from "../helpers";

function Tile({
  label,
  done,
  target,
  inProgress,
}: {
  label: string;
  done: number | null;
  target: number | null;
  inProgress: boolean;
}) {
  const tone = ratioTone(done, target, { inProgress });
  return (
    <div className="rounded-2xl border border-ink/10 bg-white px-3 py-2">
      <p className="text-[0.7rem] text-ink/55">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${tone === "met" ? "text-pine" : tone === "short" ? "text-ember" : "text-ink"}`}
      >
        {done ?? "–"}
        <span className="text-sm font-normal text-ink/50">
          /{target ?? "–"}
        </span>
      </p>
    </div>
  );
}

/**
 * Leg sessions, Peloton, ROM days and PT visits for one week. The current
 * week shows short counts neutral, green once met; red only once it is over.
 */
export function Scorecard({
  adherence,
  inProgress = false,
}: {
  adherence: WeekAdherence;
  inProgress?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Tile
        label="Legs"
        done={adherence.lifts.done}
        target={adherence.lifts.target}
        inProgress={inProgress}
      />
      <Tile
        label="Peloton"
        done={adherence.rides.done}
        target={adherence.rides.target}
        inProgress={inProgress}
      />
      <Tile
        label="ROM"
        done={adherence.romDays.done}
        target={adherence.romDays.target}
        inProgress={inProgress}
      />
      <Tile
        label="PT"
        done={adherence.pt.attended}
        target={adherence.pt.scheduled}
        inProgress={inProgress}
      />
    </div>
  );
}

/** Banners that make skipping and drift visible on the home screen. */
export function AdherenceBanners({
  snapshot,
}: {
  snapshot: AdherenceSnapshot;
}) {
  return (
    <>
      {snapshot.executionBanner ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/40 bg-ember/15 px-4 py-3 text-sm font-semibold text-ember"
        >
          Execution is the bottleneck, not the program.
          <span className="mt-0.5 block text-xs font-normal text-ink/75">
            Fewer than 3 leg sessions two weeks running. Schedule them now.
          </span>
        </div>
      ) : null}
      {snapshot.surplusBanner ? (
        <div
          role="alert"
          className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm font-semibold text-ember"
        >
          Trim the surplus. Never cut protein.
          <span className="mt-0.5 block text-xs font-normal text-ink/75">
            The 7-day weight average is climbing faster than planned.
          </span>
        </div>
      ) : null}
      {snapshot.waistDue ? (
        <Link
          href="/body"
          className="block rounded-2xl border border-ink/10 bg-sand/60 px-4 py-2 text-xs text-ink/75"
        >
          Waist at the navel is due
          {snapshot.lastWaistOn ? ` (last ${snapshot.lastWaistOn})` : ""}. Log
          it on Body →
        </Link>
      ) : null}
    </>
  );
}

export function StreakLine({ snapshot }: { snapshot: AdherenceSnapshot }) {
  return (
    <p className="text-xs text-ink/60">
      Streaks: {snapshot.liftStreakWeeks} full leg week
      {snapshot.liftStreakWeeks === 1 ? "" : "s"} · {snapshot.romStreakDays} ROM
      day{snapshot.romStreakDays === 1 ? "" : "s"}
    </p>
  );
}
