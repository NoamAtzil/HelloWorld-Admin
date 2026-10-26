export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        tone === "ok"
          ? "border-ok-text/20 bg-ok-tint text-ok-text"
          : "border-coral/25 bg-coral-tint text-coral-text"
      }`}
    >
      {children}
    </p>
  );
}

const EMPTY_ICONS = {
  posts: "M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0",
  votes: "M8 4l-5 8h10zM16 20l5-8H11z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
};

// A friendly placeholder for lists and cards with nothing in them.
export function EmptyState({
  icon = "posts",
  title,
  children,
  compact = false,
}: {
  icon?: keyof typeof EMPTY_ICONS;
  title: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${compact ? "py-4" : "py-10"}`}>
      <span className="grid h-11 w-11 place-items-center rounded-full bg-tint text-accent-text">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={EMPTY_ICONS[icon]} />
        </svg>
      </span>
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted">{children}</p>}
    </div>
  );
}
