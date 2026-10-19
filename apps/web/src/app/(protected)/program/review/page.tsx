import { PageHeader } from "@/components/shared/page-header";
import { getWeeklyReviewData } from "@/features/program/weekly-server";
import { WeeklyReviewScreen } from "@/features/program/components/weekly-review-screen";

type ReviewPageProps = {
  searchParams?: Promise<{ week?: string }>;
};

export default async function ProgramReviewPage({
  searchParams,
}: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const week = params.week != null ? Number(params.week) : undefined;
  const data = await getWeeklyReviewData(
    week != null && Number.isFinite(week) ? week : undefined,
  );
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Weekly review" />
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-6 text-sm text-ink/70">
          No active program.
        </p>
      </div>
    );
  }
  return <WeeklyReviewScreen data={data} />;
}
