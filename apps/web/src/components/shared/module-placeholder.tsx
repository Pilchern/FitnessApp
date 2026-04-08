type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  nextSteps: string[];
};

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  nextSteps,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-7 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-pine">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-ink/80">
          {description}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <article className="rounded-[1.75rem] border border-ink/10 bg-white/75 p-6 shadow-panel">
          <h2 className="font-display text-2xl text-ink">Next implementation slice</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/80">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-pine/20 bg-pine p-6 text-mist shadow-panel">
          <h2 className="font-display text-2xl">Shell status</h2>
          <p className="mt-4 text-sm leading-6 text-mist/90">
            Authentication, route protection, navigation, and profile bootstrap
            are wired. This screen is intentionally placeholder-only until the
            module’s first real data flow is implemented.
          </p>
        </article>
      </section>
    </div>
  );
}
