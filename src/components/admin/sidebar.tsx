"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUPS, groupFor } from "@/lib/nav";

// "rail" is the vertical list inside the desktop sidebar; "tabs" is the
// floating bottom bar used on small screens (rendered outside the sidebar,
// because a blurred ancestor would trap its fixed positioning).
export function Sidebar({ variant }: { variant: "rail" | "tabs" }) {
  const pathname = usePathname();
  const current = groupFor(pathname)?.key;
  const tabs = variant === "tabs";

  return (
    <nav
      aria-label={tabs ? "Admin sections (mobile)" : "Admin sections"}
      className={
        tabs
          ? "glass fixed inset-x-3 bottom-3 z-30 rounded-2xl p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
          : "hidden lg:block"
      }
    >
      <ul className={tabs ? "grid grid-cols-6 gap-1" : "flex flex-col gap-1"}>
        {GROUPS.map((group) => {
          const active = current === group.key;
          return (
            <li key={group.key}>
              <Link
                href={group.tabs[0].href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center rounded-xl text-sm transition-colors ${
                  tabs
                    ? "min-h-12 flex-col justify-center gap-0.5 px-0.5 py-1.5 text-[0.6rem] leading-tight"
                    : "gap-2.5 px-3 py-2"
                } ${
                  active
                    ? "bg-tint font-semibold text-accent-text shadow-[inset_0_0_0_1px_rgb(255_122_26/0.28)]"
                    : "font-medium text-muted hover:bg-tint/60 hover:text-ink"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={tabs ? "h-5 w-5" : "h-4 w-4"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={group.icon} />
                </svg>
                <span className={tabs ? "max-w-full truncate" : ""}>{group.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
