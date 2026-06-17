import { BodyScreen } from "@/features/body/components/body-screen";

type BodyPageProps = {
  searchParams?: Promise<{
    edit?: string;
    deleted?: string;
  }>;
};

export default async function BodyPage({ searchParams }: BodyPageProps) {
  const params = (await searchParams) ?? {};

  return <BodyScreen editMetricId={params.edit} deleted={params.deleted === "1"} />;
}
