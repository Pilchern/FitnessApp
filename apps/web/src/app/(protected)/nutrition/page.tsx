import { NutritionScreen } from "@/features/nutrition/components/nutrition-screen";

type PageProps = { searchParams?: Promise<Record<string, string>> };

export default async function NutritionPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  return <NutritionScreen editLogId={params.edit} />;
}
