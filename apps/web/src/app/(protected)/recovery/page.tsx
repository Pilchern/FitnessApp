import { RecoveryScreen } from "@/features/recovery/components/recovery-screen";

type RecoveryPageProps = {
  searchParams?: Promise<{
    edit?: string;
    error?: string;
  }>;
};

export default async function RecoveryPage({
  searchParams,
}: RecoveryPageProps) {
  const params = (await searchParams) ?? {};

  return <RecoveryScreen editCheckinId={params.edit} error={params.error} />;
}
