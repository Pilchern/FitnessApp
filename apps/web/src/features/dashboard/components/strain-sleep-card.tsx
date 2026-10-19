import { MethodNote } from "@/components/shared/method-note";
import type { StrainSleep } from "../types";

type StrainSleepCardProps = {
  data: StrainSleep;
};

function formatDay(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "narrow",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function hours(value: number) {
  return `${value.toFixed(1)} h`;
}

/**
 * Whoop-style strain (today and the last 7 days) and the sleep that follows
 * from it: last night against its need, tonight's need and lights-out.
 */
export function StrainSleepCard({ data }: StrainSleepCardProps) {
  const today = data.strain?.[data.strain.length - 1] ?? null;
  const { lastNight, tonight, wakeSpreadMinutes } = data.sleep;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
        Strain and sleep
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <div className="text-xs text-ink/55">Strain today</div>
          <div className="mt-1 text-xl font-semibold text-ink">
            {today ? today.strain.toFixed(1) : "--"}
            <span className="text-sm font-normal text-ink/50"> / 21</span>
          </div>
          <div className="mt-0.5 text-xs text-ink/55">
            {data.strain == null
              ? `Needs ${data.missing}`
              : today && today.sessions.length > 0
                ? today.sessions
                    .map((s) => `${s.label} ${s.minutes} min`)
                    .join(", ")
                : "No workouts yet"}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-ink/55">Sleep need tonight</div>
          <div className="mt-1 text-xl font-semibold text-ink">
            {hours(tonight.needHours)}
          </div>
          <div className="mt-0.5 text-xs text-ink/55">
            {tonight.inBedBy ? `In bed by ${tonight.inBedBy}` : null}
          </div>
        </div>
      </div>

      {data.strain ? (
        <div className="mt-4 flex h-12 items-end gap-1.5" aria-hidden="true">
          {data.strain.map((d) => (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className="w-full rounded-sm bg-ink/70"
                style={{ height: `${Math.max(3, (d.strain / 21) * 36)}px` }}
                title={`${d.date}: ${d.strain}`}
              />
              <span className="text-[10px] text-ink/50">
                {formatDay(d.date)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-3 text-sm">
        {lastNight ? (
          <li className="flex justify-between gap-3">
            <span className="text-ink/70">Last night</span>
            <span className="text-ink">
              {hours(lastNight.sleptHours)} of {hours(lastNight.needHours)} ·{" "}
              <span className="font-semibold">{lastNight.performancePct}%</span>
            </span>
          </li>
        ) : null}
        <li className="flex justify-between gap-3">
          <span className="text-ink/70">Tonight&apos;s extra</span>
          <span className="text-ink">
            +{hours(tonight.debtHours)} debt, +{hours(tonight.strainHours)}{" "}
            strain
          </span>
        </li>
        {wakeSpreadMinutes != null ? (
          <li className="flex justify-between gap-3">
            <span className="text-ink/70">Wake time, 7 days</span>
            <span className="text-ink">±{wakeSpreadMinutes} min</span>
          </li>
        ) : null}
      </ul>

      <MethodNote>
        Strain is Banister TRIMP from each session&apos;s average heart rate, on
        the app&apos;s own 0-21 scale (Whoop&apos;s formula is not public).
        Sleep need is 7.5 h asleep (8 h in bed to a 6:00 wake), plus up to 45
        min after a hard day and half of the last three nights&apos; shortfall.
        Lights-out never earlier than 9:30 PM, per the plan.
      </MethodNote>
    </section>
  );
}
