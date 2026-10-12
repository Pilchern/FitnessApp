import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RoutinePlayer } from "@/features/routines/components/routine-player";
import { getRoutineHabit } from "@/features/routines/server";
import { ROUTINE_PREP_SECONDS, routineBySlug } from "@/lib/routines";

type RoutinePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function RoutinePage({ params }: RoutinePageProps) {
  const { slug } = await params;
  const routine = routineBySlug(slug);
  if (!routine) notFound();

  const { habitId, doneToday } = await getRoutineHabit(routine);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/dashboard"
        className="px-1 text-sm text-ink/55 hover:text-ink"
      >
        ← Dashboard
      </Link>
      <PageHeader title={routine.title} />
      <RoutinePlayer
        routine={routine}
        prepSeconds={ROUTINE_PREP_SECONDS}
        habitId={habitId}
        doneToday={doneToday}
      />
    </div>
  );
}
