import Link from "next/link";
import type { DexaDelta } from "@fitness-app/application";
import { MethodNote } from "@/components/shared/method-note";
import { PageHeader } from "@/components/shared/page-header";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import { formatDexaDelta, formatNumber, formatScanDate } from "../helpers";
import { getDexaPageData } from "../server";
import { DexaScanForm } from "./dexa-scan-form";
import { TargetProgressList } from "./target-progress-list";

const panel =
  "rounded-[1.75rem] border border-ink/10 bg-white/80 p-5 shadow-panel";

function DeltaTable({ title, deltas }: { title: string; deltas: DexaDelta[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 divide-y divide-ink/5 text-sm">
        {deltas.map((d) => (
          <li key={d.label} className="flex justify-between gap-3 py-1.5">
            <span className="text-ink/70">{d.label}</span>
            <span
              className={`tabular-nums ${d.withinNoise ? "text-ink/45" : "text-ink"}`}
            >
              {formatDexaDelta(d)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function DexaScreen() {
  const data = await getDexaPageData();
  const c = data.comparison;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="DEXA"
        subtitle={
          <>
            Scan results, kept apart from the Withings trend.{" "}
            <Link href="/body" className="font-semibold text-pine">
              Body
            </Link>
          </>
        }
      />

      {c ? (
        <section className={panel}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Latest scan
          </p>
          <h2 className="mt-2 font-display text-xl text-ink">
            {formatScanDate(c.latest.scanDate)}
          </h2>
          <p className="text-sm text-ink/60">
            {[c.latest.facility, c.latest.machine].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <SummaryStatCard
              label="Body fat"
              value={formatNumber(c.latest.bodyFatPct, 1, "%")}
              tone="accent"
            />
            <SummaryStatCard
              label="Lean"
              value={formatNumber(c.latest.leanLb, 1, "lb")}
            />
            <SummaryStatCard
              label="Fat"
              value={formatNumber(c.latest.fatLb, 1, "lb")}
            />
            <SummaryStatCard
              label="ALMI"
              value={formatNumber(c.latestDerived.almi, 2)}
              hint="kg/m²"
            />
            <SummaryStatCard
              label="FFMI"
              value={formatNumber(c.latestDerived.ffmi, 1)}
              hint="kg/m²"
            />
            <SummaryStatCard
              label="Leg lean LSI"
              value={formatNumber(c.latestDerived.legLeanLsi, 1, "%")}
              hint={`L ${formatNumber(c.latest.leftLegLeanLb)} / R ${formatNumber(c.latest.rightLegLeanLb)} lb`}
            />
            <SummaryStatCard
              label="Arm lean LSI"
              value={formatNumber(c.latestDerived.armLeanLsi, 1, "%")}
              hint={`L ${formatNumber(c.latest.leftArmLeanLb)} / R ${formatNumber(c.latest.rightArmLeanLb)} lb`}
            />
            <SummaryStatCard
              label="VAT"
              value={formatNumber(c.latest.vatLb, 2, "lb")}
              hint={`${formatNumber(c.latest.vatIn3, 2)} in³ · A/G ${formatNumber(c.latest.agRatio, 2)}`}
            />
            <SummaryStatCard
              label="BMD"
              value={formatNumber(c.latest.bmdTotal, 3)}
              hint={`T ${formatNumber(c.latest.bmdTScore)} · Z ${formatNumber(c.latest.bmdZScore)}`}
            />
          </div>

          {c.previous || c.baseline ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {c.previous ? (
                <DeltaTable
                  title={`vs previous (${formatScanDate(c.previous.scan.scanDate)})`}
                  deltas={c.previous.deltas}
                />
              ) : null}
              {c.baseline ? (
                <DeltaTable
                  title={`vs baseline (${formatScanDate(c.baseline.scan.scanDate)})`}
                  deltas={c.baseline.deltas}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/60">
              Baseline scan. Changes show from the next scan.
            </p>
          )}

          <MethodNote>
            ALMI = (arms lean + legs lean, kg) / height m². FFMI = (lean + BMC,
            kg) / height m². LSI = left / right x 100 (left is the operated
            side). Height comes from the scan, else the profile. Lean or fat
            changes under 2.0 lb between scans are within the scanner&apos;s
            noise and are greyed out.
          </MethodNote>
        </section>
      ) : (
        <section className={panel}>
          <p className="text-sm text-ink/70">No DEXA scans yet.</p>
        </section>
      )}

      <section className={panel}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Targets
        </p>
        <TargetProgressList targets={data.targets} />
        <MethodNote label="Where the targets live">
          Edit them in Settings, Body composition. The quad strength gate is the
          Review group&apos;s LSI line 3. The bar is the share of the way from
          the first reading to the next target not yet met.
        </MethodNote>
      </section>

      <section className={panel}>
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-lg text-ink">
            Enter a scan
            <span className="text-ink/40">▾</span>
          </summary>
          <div className="mt-4">
            <DexaScanForm fields={data.fields} defaults={data.defaults} />
          </div>
        </details>
      </section>
    </div>
  );
}
