type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-8 lg:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-8 shadow-panel backdrop-blur sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pine">
            Your fitness tracker
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
            Training, recovery, and body — tracked together.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink/80">
            Log every workout, measure progress, and review your week.
            Connect Strava and Withings to pull in data automatically.
          </p>
        </section>

        <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-6 shadow-panel backdrop-blur sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
