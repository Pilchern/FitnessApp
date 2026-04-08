import { getWeeklyReviewPageData } from "../server";
import { WeeklyReviewForm } from "./weekly-review-form";

type WeeklyReviewScreenProps = {
  weekStart?: string;
};

export async function WeeklyReviewScreen({
  weekStart,
}: WeeklyReviewScreenProps) {
  const data = await getWeeklyReviewPageData(weekStart);
  return <WeeklyReviewForm data={data} />;
}
