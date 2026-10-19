"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  dashboard: "M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-5H4z",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0",
  media: "M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5",
  votes: "M8 4l-5 8h10zM16 20l5-8H11z",
};

const NAV = [
  { href: "/", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/users", label: "Users", icon: ICONS.users },
  { href: "/posts", label: "AI Media", icon: ICONS.media },
  { href: "/votes", label: "Votes", icon: ICONS.votes },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
                  active
                    ? "bg-tint font-semibold text-accent-text"
                    : "font-medium text-muted hover:bg-tint/60 hover:text-ink"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={icon} />
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
