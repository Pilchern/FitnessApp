import { BodyScreen } from "@/features/body/components/body-screen";

type BodyPageProps = {
  searchParams?: Promise<{
    edit?: string;
  }>;
};

export default async function BodyPage({ searchParams }: BodyPageProps) {
  const params = (await searchParams) ?? {};

  return <BodyScreen editMetricId={params.edit} />;
}
