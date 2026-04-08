import { StrengthScreen } from "@/features/strength/components/strength-screen";

type StrengthPageProps = {
  searchParams?: Promise<{
    edit?: string;
  }>;
};

export default async function StrengthPage({ searchParams }: StrengthPageProps) {
  const params = (await searchParams) ?? {};

  return <StrengthScreen editSessionId={params.edit} />;
}
