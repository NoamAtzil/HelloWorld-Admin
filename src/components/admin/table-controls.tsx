import Link from "next/link";

type Params = Record<string, string | undefined>;

function href(basePath: string, params: Params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// A plain GET form: works without JavaScript and keeps the URL shareable.
export function SearchForm({
  basePath,
  q,
  sort,
  sortOptions,
  placeholder,
}: {
  basePath: string;
  q: string;
  sort?: string;
  sortOptions?: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-center gap-2" role="search">
      <label htmlFor="q" className="sr-only">
        Search
      </label>
      <input
        id="q"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="field min-w-0 flex-1 sm:max-w-xs"
      />
      {sortOptions && (
        <>
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select id="sort" name="sort" defaultValue={sort} className="field w-auto">
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}
      <button type="submit" className="btn-primary">
        Search
      </button>
      {(q || (sort && sort !== sortOptions?.[0]?.value)) && (
        <Link href={basePath} className="btn-quiet">
          Clear
        </Link>
      )}
    </form>
  );
}

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Params;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={href(basePath, { ...params, page: page - 1 > 1 ? String(page - 1) : undefined })}
            className="btn-quiet"
          >
            Previous
          </Link>
        ) : (
          <span className="btn-quiet pointer-events-none opacity-50" aria-disabled="true">
            Previous
          </span>
        )}
        {page < pages ? (
          <Link href={href(basePath, { ...params, page: String(page + 1) })} className="btn-quiet">
            Next
          </Link>
        ) : (
          <span className="btn-quiet pointer-events-none opacity-50" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
