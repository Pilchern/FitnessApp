import Link from "next/link";

type Section = {
  title: string;
  description: string;
};

type AppShellProps = {
  sections: Section[];
};

export function AppShell({ sections }: AppShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
      <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white/75 p-8 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pine">
              Your Fitness Tracker
            </p>
            <div className="space-y-3">
              <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
                Track your training, recovery, and body — all in one place.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink/80 sm:text-lg">
                Log workouts, measure progress, and review your week. Connect
                Strava and Withings to import data automatically.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-ember/20 bg-sand/80 p-5 text-sm text-ink/80">
            <p className="font-semibold text-ink">Get started</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 font-semibold text-white transition hover:bg-ink/90"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full border border-ink/15 px-4 py-2 font-semibold text-ink transition hover:border-pine hover:text-pine"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[1.5rem] border border-ink/10 bg-white/70 p-6 shadow-panel"
          >
            <h2 className="font-display text-2xl text-ink">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-ink/80">
              {section.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
        <article className="rounded-[1.5rem] border border-ink/10 bg-white/70 p-6 shadow-panel">
          <h2 className="font-display text-2xl text-ink">Manual-first logging</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-ink/80">
            <li>Log workouts, measurements, and check-ins in seconds.</li>
            <li>Your data is always yours — no app required.</li>
            <li>Integrations are optional, not required.</li>
          </ul>
        </article>

        <article className="rounded-[1.5rem] border border-pine/20 bg-pine p-6 text-mist shadow-panel">
          <h2 className="font-display text-2xl">Everything in one place</h2>
          <p className="mt-3 text-sm leading-6 text-mist/90">
            Cardio, strength, recovery, body, nutrition, weekly reviews,
            journal entries, and insights — all linked together.
          </p>
        </article>
      </section>
    </main>
  );
}
