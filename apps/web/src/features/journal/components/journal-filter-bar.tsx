type JournalFilterBarProps = {
  searchTerm: string;
  tag: string;
  startDate: string;
  endDate: string;
};

function fieldClassName() {
  return "h-11 rounded-2xl border border-ink/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
}

export function JournalFilterBar({
  searchTerm,
  tag,
  startDate,
  endDate,
}: JournalFilterBarProps) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
      <form className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Search
          <input
            className={fieldClassName()}
            name="q"
            defaultValue={searchTerm}
            placeholder="Search title or body"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Tag
          <input className={fieldClassName()} name="tag" defaultValue={tag} placeholder="zone2" />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Start date
          <input className={fieldClassName()} name="startDate" type="date" defaultValue={startDate} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          End date
          <input className={fieldClassName()} name="endDate" type="date" defaultValue={endDate} />
        </label>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          >
            Apply
          </button>
          <a
            href="/journal"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink/10 px-5 text-sm font-semibold text-ink/70 transition hover:border-pine hover:text-pine"
          >
            Reset
          </a>
        </div>
      </form>
    </section>
  );
}
