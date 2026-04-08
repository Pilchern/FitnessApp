"use client";

import { useFormStatus } from "react-dom";

type SignOutFormProps = {
  action: () => Promise<void>;
  variant?: "desktop" | "mobile";
};

function SignOutButton({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={
        variant === "mobile"
          ? "w-full rounded-full border border-ink/15 px-4 py-3 text-left text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
          : "rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
      }
      disabled={pending}
    >
      {pending ? "Signing out..." : "Log out"}
    </button>
  );
}

export function SignOutForm({ action, variant }: SignOutFormProps) {
  return (
    <form action={action}>
      <SignOutButton variant={variant} />
    </form>
  );
}
