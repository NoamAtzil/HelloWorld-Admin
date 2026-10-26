// The admin sidebar groups. Each group is one sidebar entry; its pages are
// shown as tabs under the page title (see SectionTabs).
export type Tab = { href: string; label: string; exact?: boolean };
export type Group = { key: string; label: string; icon: string; tabs: Tab[] };

export const GROUPS: Group[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-5H4z",
    tabs: [
      { href: "/", label: "Dashboard", exact: true },
      { href: "/activity", label: "Activity" },
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: "M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5",
    tabs: [
      { href: "/posts", label: "AI Media" },
      { href: "/manage/images", label: "Images" },
      { href: "/manage/terms", label: "Terms" },
      { href: "/manage/examples", label: "Examples" },
    ],
  },
  {
    key: "ai",
    label: "AI Config",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
    tabs: [
      { href: "/manage/chains", label: "Chains" },
      { href: "/manage/steps", label: "Steps" },
      { href: "/manage/mix", label: "Mix" },
      { href: "/manage/models", label: "Models" },
      { href: "/manage/providers", label: "Providers" },
    ],
  },
  {
    key: "activity",
    label: "AI Activity",
    icon: "M4 19V9m6 10V5m6 14v-8m4 8H2",
    tabs: [
      { href: "/manage/requests", label: "Requests" },
      { href: "/manage/responses", label: "Responses" },
    ],
  },
  {
    key: "access",
    label: "Access",
    icon: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0",
    tabs: [
      { href: "/users", label: "Users" },
      { href: "/manage/domains", label: "Signup domains" },
      { href: "/manage/emails", label: "Whitelisted emails" },
    ],
  },
  {
    key: "community",
    label: "Community",
    icon: "M8 4l-5 8h10zM16 20l5-8H11z",
    tabs: [
      { href: "/challenges", label: "Daily Drops" },
      { href: "/votes", label: "Votes" },
    ],
  },
];

export function tabActive(pathname: string, tab: Tab) {
  return tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function groupFor(pathname: string): Group | undefined {
  return GROUPS.find((group) => group.tabs.some((tab) => tabActive(pathname, tab)));
}
