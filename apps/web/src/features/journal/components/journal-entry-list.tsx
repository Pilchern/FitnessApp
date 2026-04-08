import Link from "next/link";
import type { CardioSession, JournalEntry } from "@fitness-app/domain";
import { deleteJournalEntryAction } from "../actions";
import { formatCardioLinkLabel, formatJournalDate, summarizeBody } from "../helpers";

type JournalEntryListProps = {
  entries: JournalEntry[];
  cardioSessions: CardioSession[];
};

function findCardioLabel(
  cardioSessions: CardioSession[],
  relatedCardioSessionId: string | null,
) {
  if (!relatedCardioSessionId) {
    return null;
  }

  const session = cardioSessions.find((item) => item.id === relatedCardioSessionId);
  return session ? formatCardioLinkLabel(session) : "Linked workout";
}

export function JournalEntryList({
  entries,
  cardioSessions,
}: JournalEntryListProps) {
  if (entries.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-ink/15 bg-white/70 p-8 text-center shadow-panel">
        <h2 className="font-display text-3xl text-ink">No entries yet</h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          Write your first note above — just a body and a date is all you need.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
            Journal history
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">Entries</h2>
        </div>
        <div className="text-sm text-ink/65">{entries.length} results</div>
      </div>

      <div className="mt-5 space-y-4">
        {entries.map((entry) => {
          const cardioLabel = findCardioLabel(
            cardioSessions,
            entry.relatedCardioSessionId,
          );

          return (
            <article
              key={entry.id}
              className="rounded-[1.5rem] border border-ink/10 bg-sand/40 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-ink">
                      {entry.title ?? formatJournalDate(entry.entryDate)}
                    </h3>
                    <span className="text-sm text-ink/65">
                      {formatJournalDate(entry.entryDate)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/journal?tag=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-pine/20 bg-pine/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-pine"
                      >
                        #{tag}
                      </Link>
                    ))}
                    {entry.relatedWeekStart ? (
                      <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/65">
                        Week of {entry.relatedWeekStart}
                      </span>
                    ) : null}
                    {cardioLabel ? (
                      <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/65">
                        {cardioLabel}
                      </span>
                    ) : null}
                    {entry.relatedStrengthSessionId ? (
                      <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/65">
                        Linked session
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm leading-6 text-ink/75">
                    {summarizeBody(entry.body)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/journal?edit=${entry.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Edit
                  </Link>
                  <form action={deleteJournalEntryAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-ember/20 px-4 text-sm font-semibold text-ember transition hover:bg-ember/10"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
