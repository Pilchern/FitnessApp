import { SettingsScreen } from "@/features/settings/components/settings-screen";

type PageProps = {
  searchParams?: Promise<Record<string, string>>;
};

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  return <SettingsScreen saved={params.saved === "true"} />;
}
