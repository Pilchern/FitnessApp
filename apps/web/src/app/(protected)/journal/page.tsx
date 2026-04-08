import { JournalScreen } from "@/features/journal/components/journal-screen";

type JournalPageProps = {
  searchParams?: Promise<{
    edit?: string;
    q?: string;
    tag?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <JournalScreen
      editEntryId={params.edit}
      searchTerm={params.q}
      tag={params.tag}
      startDate={params.startDate}
      endDate={params.endDate}
    />
  );
}
