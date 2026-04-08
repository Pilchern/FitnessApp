import { IntegrationsScreen } from "@/features/integrations/components/integrations-screen";

type IntegrationsPageProps = {
  searchParams?: Promise<{
    status?: string;
    error?: string;
  }>;
};

export default async function IntegrationsPage({
  searchParams,
}: IntegrationsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <IntegrationsScreen
      status={resolvedSearchParams?.status}
      error={resolvedSearchParams?.error}
    />
  );
}
