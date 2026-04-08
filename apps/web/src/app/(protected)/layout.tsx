import { moduleNavigationItems } from "@/lib/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { ensureProfileForUser } from "@/lib/server/profile-bootstrap";
import { logoutAction } from "../(auth)/actions";
import { ProtectedShell } from "@/components/shared/protected-shell";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const user = await requireCurrentUser();
  const profile = await ensureProfileForUser(user);

  return (
    <ProtectedShell
      items={moduleNavigationItems}
      userDisplayName={profile.display_name ?? user.email ?? "Athlete"}
      userEmail={user.email ?? "No email available"}
      logoutAction={logoutAction}
    >
      {children}
    </ProtectedShell>
  );
}
