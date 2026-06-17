import {
  createJournalEntryAction,
  updateJournalEntryAction,
} from "../actions";
import { getJournalPageData } from "../server";
import { JournalEntryForm } from "./journal-entry-form";
import { JournalEntryList } from "./journal-entry-list";
import { JournalFilterBar } from "./journal-filter-bar";

type JournalScreenProps = {
  editEntryId?: string;
  searchTerm?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
};

export async function JournalScreen({
  editEntryId,
  searchTerm,
  tag,
  startDate,
  endDate,
}: JournalScreenProps) {
  const data = await getJournalPageData({
    editEntryId,
    searchTerm,
    tag,
    startDate,
    endDate,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Notes
        </p>
        <h1 className="mt-3 font-display text-2xl md:text-4xl text-ink">Journal</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Capture quick notes about your training. Add tags to keep things
          searchable and link entries to specific rides or weeks.
        </p>
      </section>

      <JournalEntryForm
        mode={data.editingEntry ? "edit" : "create"}
        entry={data.editingEntry}
        cardioSessions={data.cardioSessions}
        action={data.editingEntry ? updateJournalEntryAction : createJournalEntryAction}
        formError={data.formError}
      />

      <JournalFilterBar {...data.filters} />

      <JournalEntryList entries={data.entries} cardioSessions={data.cardioSessions} />
    </div>
  );
}
