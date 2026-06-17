import { CardioScreen } from "@/features/cardio/components/cardio-screen";

type CardioPageProps = {
  searchParams?: Promise<{
    edit?: string;
    deleted?: string;
  }>;
};

export default async function CardioPage({ searchParams }: CardioPageProps) {
  const params = (await searchParams) ?? {};

  return <CardioScreen editSessionId={params.edit} deleted={params.deleted === "1"} />;
}
