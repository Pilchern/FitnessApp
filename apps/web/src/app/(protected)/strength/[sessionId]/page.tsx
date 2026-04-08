import { StrengthDetailScreen } from "@/features/strength/components/strength-detail-screen";

type StrengthDetailPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function StrengthDetailPage({
  params,
}: StrengthDetailPageProps) {
  const resolvedParams = await params;
  return <StrengthDetailScreen sessionId={resolvedParams.sessionId} />;
}
