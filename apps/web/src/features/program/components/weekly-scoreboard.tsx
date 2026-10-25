import type { ScoreboardRow } from "@fitness-app/application";
import { MethodNote } from "@/components/shared/method-note";
import { formatShortDate } from "../helpers";

const NO = <span className="text-ink/35">no data</span>;

function num(value: number | null, dp = 0, unit = "") {
  return value == null ? NO : `${value.toFixed(dp)}${unit}`;
}

function signed(value: number | null) {
  if (value == null) return NO;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function pair(left: number | null, right: number | null, dp = 1) {
  if (left == null && right == null) return NO;
  const f = (v: number | null) => (v == null ? "–" : v.toFixed(dp));
  return `${f(left)} / ${f(right)}`;
}

/** One row per week: weight, fuel, quad force and LSI, tape, steps, gait. */
export function WeeklyScoreboard({ rows }: { rows: ScoreboardRow[] }) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <h2 className="font-display text-lg text-ink">Scoreboard</h2>
      <p className="mt-1 text-sm text-ink/60">
        One row per post-op week, newest first.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm tabular-nums">
          <thead className="text-xs text-ink/55">
            <tr>
              <th className="sticky left-0 bg-white py-2 pr-3 font-medium">
                Week
              </th>
              <th className="py-2 pr-3 font-medium">Weight 7d avg</th>
              <th className="py-2 pr-3 font-medium">Δ wk</th>
              <th className="py-2 pr-3 font-medium">kcal</th>
              <th className="py-2 pr-3 font-medium">Protein</th>
              <th className="py-2 pr-3 font-medium">Quad peak L / R</th>
              <th className="py-2 pr-3 font-medium">Quad LSI</th>
              <th className="py-2 pr-3 font-medium">Thigh L / R</th>
              <th className="py-2 pr-3 font-medium">Waist</th>
              <th className="py-2 pr-3 font-medium">Steps</th>
              <th className="py-2 font-medium">Walk asym.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5 text-ink">
            {rows.map((r) => (
              <tr key={r.week}>
                <td className="sticky left-0 bg-white py-2 pr-3">
                  <span className="font-semibold">{r.week}</span>{" "}
                  <span className="text-xs text-ink/50">
                    {formatShortDate(r.start)}
                  </span>
                </td>
                <td className="py-2 pr-3">{num(r.weightAvgLb, 1, " lb")}</td>
                <td className="py-2 pr-3">{signed(r.weightChangeLb)}</td>
                <td className="py-2 pr-3">
                  {num(r.kcalAvg)}
                  {r.nutritionDays > 0 ? (
                    <span className="text-xs text-ink/45">
                      {" "}
                      ({r.nutritionDays}d)
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{num(r.proteinAvg, 0, " g")}</td>
                <td className="py-2 pr-3">
                  {pair(r.quadPeakLeft, r.quadPeakRight, 0)}
                  {r.quadPeakUnit && r.quadPeakLeft != null ? (
                    <span className="text-xs text-ink/45">
                      {" "}
                      {r.quadPeakUnit}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{num(r.quadLsi, 1, "%")}</td>
                <td className="py-2 pr-3">{pair(r.thighLIn, r.thighRIn)}</td>
                <td className="py-2 pr-3">{num(r.waistIn, 1, " in")}</td>
                <td className="py-2 pr-3">{num(r.stepsAvg)}</td>
                <td className="py-2">{num(r.walkingAsymmetryPct, 1, "%")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MethodNote label="Where the numbers come from">
        Weight: mean of the week&apos;s Withings weigh-ins; Δ is vs the week
        before. kcal and protein: mean of logged days (days with kcal in
        brackets). Quad peak: best crane-scale trial per leg at 90° on the
        week&apos;s last PT Tracker test; LSI = L / R. Thigh and waist: last
        tape reading that week. Steps: Apple Health daily mean. Walking
        asymmetry: PT Tracker, else the weekly check-in (Apple Health does not
        sync it here).
      </MethodNote>
    </section>
  );
}
