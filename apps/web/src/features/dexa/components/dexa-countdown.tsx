import Link from "next/link";
import {
  PRE_SCAN_CHECKLIST,
  type NextDexaScan,
} from "@fitness-app/application";
import { formatScanDate } from "../helpers";

function countdown(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Next DEXA date with a countdown and the pre-scan checklist. */
export function DexaCountdown({
  next,
  card = true,
}: {
  next: NextDexaScan;
  card?: boolean;
}) {
  const sameAs = [next.facility, next.machine].filter(Boolean).join(", ");
  return (
    <section
      className={
        card
          ? "rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6"
          : ""
      }
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg text-ink">Next DEXA</h2>
        {card ? (
          <Link
            href="/body/dexa"
            className="text-sm font-semibold text-pine hover:underline"
          >
            DEXA
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-semibold text-ink">
        {formatScanDate(next.date)}{" "}
        <span className="text-base font-normal text-ink/60">
          {countdown(next.daysAway)}
        </span>
      </p>
      {next.following ? (
        <p className="text-sm text-ink/55">
          Then {formatScanDate(next.following)}
          {next.basis === "every_6_months" ? " (every 6 months)" : ""}
        </p>
      ) : null}
      <details className="group mt-3 border-t border-ink/10 pt-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-medium text-ink/70">
          Pre-scan checklist
          <span className="text-ink/40 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ul className="list-disc space-y-1 pb-1 pl-5 text-sm text-ink/70">
          {PRE_SCAN_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {sameAs ? (
            <li className="list-none -ml-5 text-xs text-ink/50">
              Last scan: {sameAs}
            </li>
          ) : null}
        </ul>
      </details>
    </section>
  );
}
