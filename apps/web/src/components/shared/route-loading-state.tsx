/**
 * Shown while a protected page loads: card-shaped placeholders only, so the
 * page does not flash a title and copy that then jump away.
 */
export function RouteLoadingState() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2 lg:gap-6"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-[1.75rem] border border-ink/10 bg-white/70 shadow-panel"
        />
      ))}
    </div>
  );
}
