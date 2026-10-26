"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupFor, tabActive } from "@/lib/nav";

// Sibling pages of the current section, shown as a tab strip above the page.
export function SectionTabs() {
  const pathname = usePathname();
  const group = groupFor(pathname);
  if (!group || group.tabs.length < 2) return null;

  return (
    <nav aria-label={`${group.label} pages`} className="-mb-2">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto">
        {group.tabs.map((tab) => {
          const active = tabActive(pathname, tab);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-tint font-semibold text-accent-text shadow-[inset_0_0_0_1px_rgb(255_122_26/0.28)]"
                    : "font-medium text-muted hover:bg-tint/60 hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
