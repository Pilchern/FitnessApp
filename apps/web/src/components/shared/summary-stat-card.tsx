type SummaryStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "alert";
};

const toneClasses: Record<NonNullable<SummaryStatCardProps["tone"]>, string> = {
  default: "border-ink/10 bg-sand/60 text-ink",
  accent: "border-pine/20 bg-pine/10 text-pine",
  alert: "border-ember/20 bg-ember/10 text-ember",
};

export function SummaryStatCard({
  label,
  value,
  hint,
  tone = "default",
}: SummaryStatCardProps) {
  return (
    <div
      className={`rounded-[1.25rem] border p-4 ${toneClasses[tone]}`}
    >
      <div className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {hint ? <div className="mt-2 text-sm opacity-80">{hint}</div> : null}
    </div>
  );
}
