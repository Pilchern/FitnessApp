import { StrengthScreen } from "@/features/strength/components/strength-screen";

type StrengthPageProps = {
  searchParams?: Promise<{
    edit?: string;
    error?: string;
    /** Make up a missed program lift: its session id and scheduled date. */
    makeup?: string;
    date?: string;
  }>;
};

export default async function StrengthPage({
  searchParams,
}: StrengthPageProps) {
  const params = (await searchParams) ?? {};

  const makeUp =
    params.makeup && params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? { sessionId: params.makeup, date: params.date }
      : null;

  return (
    <StrengthScreen
      editSessionId={params.edit}
      error={params.error}
      makeUp={makeUp}
    />
  );
}
