import { redirect } from "next/navigation";

/** The scored weekly review was retired 2026-11-22; the program review holds the tests. */
export default function WeeklyReviewPage() {
  redirect("/program/review");
}
