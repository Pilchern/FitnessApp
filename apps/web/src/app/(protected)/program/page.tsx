import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";
import { getProgramPageData } from "@/features/program/server";
import { getAdherenceSnapshot } from "@/features/program/weekly-server";
import { ProgramTodayCard } from "@/features/program/components/program-today-card";
import {
  ProgramGatesSummary,
  ProgramMilestones,
  ProgramProgress,
  ProgramWeekView,
} from "@/features/program/components/program-sections";

export default async function ProgramPage() {
  const [data, snapshot] = await Promise.all([
    getProgramPageData(),
    getAdherenceSnapshot().catch((error) => {
      console.error("Adherence snapshot failed to load", error);
      return null;
    }),
  ]);

  if (!data.program || !data.today) {
    return (
      <div className="space-y-4">
        <PageHeader title="Program" />
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-6 text-sm text-ink/70">
          No active program. Apply the program migrations to seed it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Program" subtitle={data.program.name} />
      <div className="flex flex-wrap gap-2 px-1">
        <Link
          href="/program/review"
          className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold text-ink"
        >
          Weekly review
        </Link>
        <a
          href="/api/program/calendar"
          className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold text-ink"
        >
          Calendar (.ics)
        </a>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <ProgramTodayCard today={data.today} detailed snapshot={snapshot} />
          <ProgramWeekView week={data.week} />
        </div>
        <div className="space-y-4 lg:space-y-6">
          <ProgramProgress
            hardSets={data.hardSets}
            hardSetTarget={data.hardSetTarget}
            progress={data.progress}
          />
          <ProgramMilestones milestones={data.milestones} />
          <ProgramGatesSummary gates={data.gates} />
        </div>
      </div>
    </div>
  );
}
