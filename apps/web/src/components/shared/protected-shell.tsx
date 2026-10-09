"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { moduleNavigationItems } from "@/lib/navigation";

type NavigationItem = (typeof moduleNavigationItems)[number];

type ProtectedShellProps = {
  children: React.ReactNode;
  items: readonly NavigationItem[];
  userDisplayName: string;
};

// Bottom tab bar on phones: the four screens used daily, plus a More sheet.
const primaryHrefs = ["/dashboard", "/strength", "/cardio", "/recovery"];

export function ProtectedShell({
  children,
  items,
  userDisplayName,
}: ProtectedShellProps) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  const primary = primaryHrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is NavigationItem => Boolean(item));
  const secondary = items.filter((item) => !primaryHrefs.includes(item.href));
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = secondary.some((item) => isActive(item.href));

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(232,238,242,0.95),transparent_36%),linear-gradient(180deg,#f4e6d1_0%,#fbf7f0_54%,#f3efe7_100%)] text-ink">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl gap-6 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:py-4">
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
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-[1.4rem] border px-4 py-3 transition ${
                  isActive(item.href)
                    ? "border-pine/30 bg-pine text-white"
                    : "border-ink/10 bg-white/40 text-ink hover:border-pine/30 hover:bg-pine/5"
                }`}
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <div
                  className={`mt-1 text-xs leading-5 ${
                    isActive(item.href) ? "text-white/80" : "text-ink/65"
                  }`}
                >
                  {item.description}
                </div>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-[1.5rem] border border-ink/10 bg-sand/70 p-4 text-sm font-semibold text-ink">
            {userDisplayName}
          </div>
        </aside>

        <main className="min-w-0 flex-1 rounded-[1.5rem] border border-ink/10 bg-white/55 p-3 shadow-panel backdrop-blur sm:rounded-[2rem] sm:p-6">
          {children}
        </main>
      </div>

      {isMoreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-[1.75rem] bg-white p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-2">
              {secondary.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-14 items-center rounded-2xl border px-4 text-sm font-semibold ${
                    isActive(item.href)
                      ? "border-pine/30 bg-pine text-white"
                      : "border-ink/10 bg-sand/40 text-ink"
                  }`}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {primary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex h-16 items-center justify-center text-xs font-semibold ${
                  isActive(item.href) ? "text-pine" : "text-ink/60"
                }`}
              >
                {item.title}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((open) => !open)}
              className={`flex h-16 w-full items-center justify-center text-xs font-semibold ${
                moreActive || isMoreOpen ? "text-pine" : "text-ink/60"
              }`}
            >
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
