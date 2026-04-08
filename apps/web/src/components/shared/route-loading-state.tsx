type RouteLoadingStateProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RouteLoadingState({
  eyebrow,
  title,
  description,
}: RouteLoadingStateProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
          {description}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[1.5rem] border border-ink/10 bg-white/70 shadow-panel"
          />
        ))}
      </section>
    </div>
  );
}
