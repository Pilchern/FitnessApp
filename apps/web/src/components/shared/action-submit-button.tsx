"use client";

import { useFormStatus } from "react-dom";

type ActionSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  tone?: "primary" | "secondary" | "danger";
};

const toneClasses: Record<NonNullable<ActionSubmitButtonProps["tone"]>, string> = {
  primary:
    "bg-ink text-white hover:bg-ink/90 disabled:bg-ink/60 disabled:text-white",
  secondary:
    "border border-ink/15 bg-white text-ink hover:border-pine hover:text-pine disabled:border-ink/10 disabled:text-ink/45",
  danger:
    "border border-ember/20 bg-ember/10 text-ember hover:bg-ember/15 disabled:border-ember/10 disabled:text-ember/50",
};

export function ActionSubmitButton({
  idleLabel,
  pendingLabel,
  tone = "primary",
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed ${toneClasses[tone]}`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
