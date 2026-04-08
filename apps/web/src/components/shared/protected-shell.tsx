"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { moduleNavigationItems } from "@/lib/navigation";
import { SignOutForm } from "./sign-out-form";

type NavigationItem = (typeof moduleNavigationItems)[number];

type ProtectedShellProps = {
  children: React.ReactNode;
  items: readonly NavigationItem[];
  userDisplayName: string;
  userEmail: string;
  logoutAction: () => Promise<void>;
};

export function ProtectedShell({
  children,
  items,
  userDisplayName,
  userEmail,
  logoutAction,
}: ProtectedShellProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(232,238,242,0.95),transparent_36%),linear-gradient(180deg,#f4e6d1_0%,#fbf7f0_54%,#f3efe7_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-80 shrink-0 rounded-[2rem] border border-ink/10 bg-white/80 p-5 shadow-panel backdrop-blur lg:flex lg:flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pine">
              Your Training
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
              Fitness Tracker
            </h1>
          </div>

          <nav className="mt-8 flex-1 space-y-2">
            {items.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-[1.4rem] border px-4 py-3 transition ${
                    isActive
                      ? "border-pine/30 bg-pine text-white"
                      : "border-ink/10 bg-white/40 text-ink hover:border-pine/30 hover:bg-pine/5"
                  }`}
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div
                    className={`mt-1 text-xs leading-5 ${
                      isActive ? "text-white/80" : "text-ink/65"
                    }`}
                  >
                    {item.description}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[1.5rem] border border-ink/10 bg-sand/70 p-4">
            <div className="text-sm font-semibold text-ink">{userDisplayName}</div>
            <div className="mt-1 text-xs text-ink/65">{userEmail}</div>
            <div className="mt-4">
              <SignOutForm action={logoutAction} />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-4 shadow-panel backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine">
                  Fitness App
                </p>
                <p className="mt-1 text-sm text-ink/70">{userDisplayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen((open) => !open)}
                className="rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink"
              >
                {isMobileOpen ? "Close" : "Menu"}
              </button>
            </div>

            {isMobileOpen ? (
              <div className="mt-4 space-y-2 border-t border-ink/10 pt-4">
                {items.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`block rounded-[1.2rem] border px-4 py-3 text-sm transition ${
                        isActive
                          ? "border-pine/30 bg-pine text-white"
                          : "border-ink/10 bg-white/40 text-ink"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}

                <div className="pt-2">
                  <SignOutForm action={logoutAction} variant="mobile" />
                </div>
              </div>
            ) : null}
          </header>

          <main className="mt-4 flex-1 rounded-[2rem] border border-ink/10 bg-white/55 p-4 shadow-panel backdrop-blur sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
