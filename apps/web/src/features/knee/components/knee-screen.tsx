import Link from "next/link";
import {
  bestBySide,
  latestValue,
  lsiPct,
  type SidePair,
} from "@fitness-app/application";
import type { KneeTest } from "@fitness-app/domain";
import { PageHeader } from "@/components/shared/page-header";
import { formatShortDate } from "@/features/program/helpers";
import { getKneePageData } from "../server";
import { KneeTestForm } from "./knee-test-form";

const panel =
  "rounded-[1.75rem] border border-ink/10 bg-white/80 p-5 shadow-panel";

/** Quad LSI per test date against the lsi_target lines. */
function LsiTrend({
  points,
  targets,
}: {
  points: { date: string; lsi: number }[];
  targets: number[];
}) {
  if (points.length === 0) {
    return <p className="mt-2 text-sm text-ink/55">No crane tests yet.</p>;
  }
  const min = 40;
  const max = 110;
  const height = 120;
  const width = 320;
  const pad = 24;
  const y = (v: number) =>
    height - ((Math.min(Math.max(v, min), max) - min) / (max - min)) * height;
  const x = (i: number) =>
    points.length <= 1
      ? width / 2
      : (i / (points.length - 1)) * (width - 2 * pad) + pad;
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 16}`}
      className="mt-2 h-auto w-full"
      role="img"
      aria-label={`Quad LSI: ${points.map((p) => `${p.date} ${p.lsi}%`).join(", ")}`}
    >
      {targets.map((t) => (
        <g key={t}>
          <line
            x1={0}
            x2={width}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            className="text-ink/20"
            strokeDasharray="4 4"
          />
          <text
            x={width - 2}
            y={y(t) - 2}
            textAnchor="end"
            className="fill-ink/45 text-[10px]"
          >
            {t}%
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-pine"
        points={points.map((p, i) => `${x(i)},${y(p.lsi)}`).join(" ")}
      />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.lsi)} r={3} className="fill-pine" />
          <text
            x={x(i)}
            y={y(p.lsi) - 6}
            textAnchor="middle"
            className="fill-ink/70 text-[9px]"
          >
            {p.lsi}
          </text>
          {i === 0 || i === points.length - 1 || points.length <= 6 ? (
            <text
              x={x(i)}
              y={height + 13}
              textAnchor="middle"
              className="fill-ink/50 text-[10px]"
            >
              {formatShortDate(p.date)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function last(pairs: SidePair[]) {
  return pairs[pairs.length - 1] ?? null;
}

/** Newest value of each other reading, with its date. */
function latestRows(tests: KneeTest[]) {
  const value = (type: string, unit: string) => {
    const v = latestValue(
      tests.filter((t) => t.side !== "R"),
      type,
    );
    return v ? `${v.value}${unit} (${formatShortDate(v.date)})` : null;
  };
  const pair = (type: string, unit: string, lsi = false) => {
    const p = last(bestBySide(tests, type));
    if (!p) return null;
    const l = lsi ? lsiPct(p.left, p.right) : null;
    return `L ${p.left ?? "–"} / R ${p.right ?? "–"}${unit}${l != null ? `, LSI ${l}%` : ""} (${formatShortDate(p.date)})`;
  };
  return [
    ["Flexion active", value("flexion_active", "°")],
    ["Flexion passive", value("flexion_passive", "°")],
    ["Extension", value("extension", "°")],
    ["Knee girth", pair("knee_girth", " cm")],
    ["Thigh girth", pair("thigh_girth", " cm")],
    ["Walking asymmetry", value("walking_asymmetry", "%")],
    ["ACL-RSI", value("acl_rsi", "%")],
    ["Single hop", pair("hop_single", " cm", true)],
  ].filter((r): r is [string, string] => r[1] != null);
}

export async function KneeScreen() {
  const data = await getKneePageData();
  const l = data.latest;
  const rows = latestRows(data.tests);
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Knee tests"
        subtitle={
          <>
            Crane test, ROM, girth and hop tests. L = operated knee.{" "}
            <Link href="/program/review" className="font-semibold text-pine">
              Weekly review
            </Link>
          </>
        }
      />

      <section className={panel}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Quad LSI 90°
        </p>
        {l ? (
          <p className="mt-2 text-sm text-ink">
            <span className="font-display text-2xl">
              {l.lsi != null ? `${l.lsi}%` : "–"}
            </span>{" "}
            L {l.left ?? "–"} / R {l.right ?? "–"} N · {formatShortDate(l.date)}{" "}
            ({l.source.replace(/_/g, " ")})
          </p>
        ) : null}
        {data.quadDrop ? (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember"
          >
            Left quad down {data.quadDrop.dropN} N ({data.quadDrop.previousLeft}{" "}
            to {data.quadDrop.left} N): leg loads held.
          </p>
        ) : null}
        <LsiTrend points={data.trend} targets={data.lsiTargets} />
        <p className="mt-1 text-xs text-ink/50">
          Best of 3 per side, both apps. Lines: {data.lsiTargets.join(" / ")}%.
        </p>
      </section>

      <section className={panel}>
        <h2 className="font-display text-lg text-ink">New test</h2>
        <div className="mt-3">
          <KneeTestForm today={data.today} spreadLimitN={data.spreadLimitN} />
        </div>
      </section>

      {rows.length > 0 ? (
        <section className={panel}>
          <h2 className="font-display text-lg text-ink">Latest readings</h2>
          <ul className="mt-2 divide-y divide-ink/10 text-sm">
            {rows.map(([label, value]) => (
              <li key={label} className="flex justify-between gap-3 py-1.5">
                <span className="text-ink/70">{label}</span>
                <span className="text-right tabular-nums text-ink">
                  {value}
                </span>
              </li>
            ))}
          </ul>
          {data.recent.length > 0 ? (
            <p className="mt-2 text-xs text-ink/50">
              Entered here:{" "}
              {data.recent
                .map((r) => `${formatShortDate(r.date)} (${r.count})`)
                .join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
