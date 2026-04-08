"use client";

type RouteErrorStateProps = {
  title: string;
  description: string;
  reset: () => void;
};

export function RouteErrorState({
  title,
  description,
  reset,
}: RouteErrorStateProps) {
  return (
    <div className="rounded-[1.75rem] border border-ember/20 bg-white/85 p-6 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">
        Something went wrong
      </p>
      <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/75">
        {description}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90"
      >
        Try again
      </button>
    </div>
  );
}
