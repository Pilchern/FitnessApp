export function DangerZone() {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-5 shadow-panel sm:p-6">
      <h2 className="font-display text-2xl text-ink">Your data</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-ink/70">
          Download everything you&apos;ve logged as one JSON file. Never
          includes integration credentials or tokens.
        </p>
        <a
          href="/api/account/export"
          download
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
        >
          Export my data
        </a>
      </div>
    </section>
  );
}
