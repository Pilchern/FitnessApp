import { WeeklyReviewScreen } from "@/features/weekly-review/components/weekly-review-screen";

type WeeklyReviewPageProps = {
  searchParams?: Promise<{
    weekStart?: string;
  }>;
};

export default async function WeeklyReviewPage({
  searchParams,
}: WeeklyReviewPageProps) {
  const params = (await searchParams) ?? {};
  return <WeeklyReviewScreen weekStart={params.weekStart} />;
}
