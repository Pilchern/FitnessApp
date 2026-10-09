import { moduleNavigationItems } from "@/lib/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { ensureProfileForUser } from "@/lib/server/profile-bootstrap";
import { ProtectedShell } from "@/components/shared/protected-shell";
import { ToastProvider } from "@/components/shared/toast-provider";

// No cookies/session anymore, so force dynamic or Next prerenders at build time.
export const dynamic = "force-dynamic";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const user = await requireCurrentUser();
  const profile = await ensureProfileForUser(user);

  return (
    <ToastProvider>
      <ProtectedShell
        items={moduleNavigationItems}
        userDisplayName={profile.display_name ?? "Athlete"}
      >
        {children}
      </ProtectedShell>
    </ToastProvider>
  );
}
