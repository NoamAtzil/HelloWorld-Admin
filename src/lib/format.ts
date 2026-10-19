export const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function fullName(first: string | null, last: string | null) {
  return [first, last].filter(Boolean).join(" ") || "Unnamed";
}

// Query-string helpers (search params arrive as string | string[] | undefined).
export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function pageNumber(value: string | string[] | undefined) {
  const n = Number.parseInt(one(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
