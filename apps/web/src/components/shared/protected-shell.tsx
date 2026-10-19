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
// Cardio lives in More: rides sync from Apple Health, so it is rarely opened.
const primaryHrefs = ["/dashboard", "/program", "/strength", "/recovery"];

// 24x24 stroke icons for the tab bar (home, calendar check, dumbbell, moon, dots).
const tabIconPaths: Record<string, string> = {
  "/dashboard":
    "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  "/strength": "M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11",
  "/program":
    "M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8.5 14.5l2 2 4-4",
  "/recovery": "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

function TabIcon({ path }: { path?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

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
    <div className="min-h-[100dvh] bg-[#f4f5f7] text-ink">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl gap-6 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:py-4">
        <aside className="hidden w-80 shrink-0 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel lg:flex lg:flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pine">
              Your Training
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
              Fitness Tracker
            </h1>
          </div>

          <nav className="mt-8 flex-1 space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-2xl px-4 py-3 transition ${
                  isActive(item.href)
                    ? "bg-pine text-white"
                    : "text-ink hover:bg-ink/5"
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

          <div className="mt-6 rounded-2xl bg-sand p-4 text-sm font-semibold text-ink">
            {userDisplayName}
          </div>
        </aside>

        {/* No backdrop-filter here: it makes <main> the containing block for
            position:fixed children, which pins the lift logger's Finish bar and
            rest timer to the bottom of the page instead of the screen. */}
        <main className="min-w-0 flex-1 lg:py-2">{children}</main>
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
                  className={`flex min-h-14 items-center rounded-2xl px-4 text-sm font-semibold ${
                    isActive(item.href)
                      ? "bg-pine text-white"
                      : "bg-sand text-ink"
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {primary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                  isActive(item.href) ? "text-pine" : "text-ink/50"
                }`}
              >
                <TabIcon path={tabIconPaths[item.href]} />
                {item.title}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((open) => !open)}
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                moreActive || isMoreOpen ? "text-pine" : "text-ink/50"
              }`}
            >
              <TabIcon path={tabIconPaths.more} />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
