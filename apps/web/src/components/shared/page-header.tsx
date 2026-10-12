type PageHeaderProps = {
  title: string;
  /** One short line; leave out when the title says enough. */
  subtitle?: React.ReactNode;
};

/** Plain page title. Pages lead with their content, not a header panel. */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="px-1">
      <h1 className="font-display text-2xl text-ink md:text-3xl">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm leading-6 text-ink/60">{subtitle}</p>
      ) : null}
    </header>
  );
}
