/** Methodology fine print, collapsed so it doesn't push the card's numbers down. */
export function MethodNote({
  children,
  label = "How it's calculated",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <details className="group mt-3 border-t border-ink/10 pt-2">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-xs font-medium text-ink/55">
        {label}
        <span className="text-ink/40 transition group-open:rotate-180">▾</span>
      </summary>
      <p className="pb-1 text-xs leading-5 text-ink/50">{children}</p>
    </details>
  );
}
