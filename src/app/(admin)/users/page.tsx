import { requireAdmin } from "@/lib/admin";
import { formatDate, fullName, initials, one, pageNumber } from "@/lib/format";
import type { UserRow } from "@/lib/types";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination, SearchForm } from "@/components/admin/table-controls";

const PAGE_SIZE = 20;
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "posts", label: "Most posts" },
  { value: "votes", label: "Most votes" },
];

export default async function UsersPage(props: PageProps<"/users">) {
  const { supabase } = await requireAdmin();
  const params = await props.searchParams;

  const q = (one(params.q) ?? "").trim().slice(0, 100);
  const requestedSort = one(params.sort) ?? "newest";
  const sort = SORTS.some((s) => s.value === requestedSort) ? requestedSort : "newest";
  const page = pageNumber(params.page);

  const { data, error } = await supabase.rpc("admin_users", {
    p_search: q,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) console.error("admin_users failed:", error);
  const rows = (data ?? []) as UserRow[];
  const total = rows[0]?.total_count ?? 0;

  return (
    <>
      <PageHeader
        title="Users"
        description="Read-only list of everyone who has signed in."
      />
      <SearchForm
        basePath="/users"
        q={q}
        sort={sort}
        sortOptions={SORTS}
        placeholder="Search name or email"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load users. Please refresh the page.
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Email</th>
              <th scope="col" className="text-right">Posts</th>
              <th scope="col" className="text-right">Votes</th>
              <th scope="col">Joined</th>
              <th scope="col">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const name = fullName(user.first_name, user.last_name);
              return (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="grid h-8 w-8 place-items-center rounded-full bg-tint text-xs font-semibold text-accent-text"
                        >
                          {initials(name)}
                        </span>
                      )}
                      <span className="font-medium">{name}</span>
                      {user.is_superadmin && (
                        <span className="rounded-md bg-tint px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-text">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted">{user.email ?? "—"}</td>
                  <td className="text-right tabular-nums">{user.posts}</td>
                  <td className="text-right tabular-nums">{user.votes}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(user.created_at)}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(user.last_sign_in_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted">
                  {q ? "No users match that search." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/users"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        params={{ q: q || undefined, sort: sort === "newest" ? undefined : sort }}
      />
    </>
  );
}
