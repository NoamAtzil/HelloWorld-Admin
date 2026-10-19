import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime, formatNumber, pageNumber } from "@/lib/format";
import type { VoteRow } from "@/lib/types";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/table-controls";
import { StatCard } from "@/components/admin/stat-card";

const PAGE_SIZE = 25;

export default async function VotesPage(props: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const page = pageNumber((await props.searchParams).page);

  const { data, error } = await supabase.rpc("admin_votes", {
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) console.error("admin_votes failed:", error);
  const rows = (data ?? []) as VoteRow[];
  const total = rows[0]?.total_count ?? 0;
  const up = rows[0]?.total_up ?? 0;
  const down = rows[0]?.total_down ?? 0;

  return (
    <>
      <PageHeader
        title="Votes"
        description="Read-only voting history, newest first."
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total votes" value={formatNumber(total)} />
        <StatCard label="Upvotes" value={formatNumber(up)} />
        <StatCard label="Downvotes" value={formatNumber(down)} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load votes. Please refresh the page.
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Voter</th>
              <th scope="col">Vote</th>
              <th scope="col">Post</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((vote) => (
              <tr key={vote.id}>
                <td className="whitespace-nowrap text-muted">{formatDateTime(vote.created_at)}</td>
                <td>
                  <span className="block font-medium">{vote.voter_name}</span>
                  <span className="block text-xs text-muted">{vote.voter_email ?? ""}</span>
                </td>
                <td>
                  {/* Text + shape, not color alone. */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      vote.value === 1 ? "bg-tint text-accent-text" : "bg-coral-tint text-coral-text"
                    }`}
                  >
                    {vote.value === 1 ? "▲ Up" : "▼ Down"}
                  </span>
                </td>
                <td className="max-w-xs">
                  <Link
                    href={`/posts/${vote.generation_id}`}
                    className="block truncate text-accent-text underline-offset-2 hover:underline"
                  >
                    #{vote.generation_id} {vote.post_content ?? ""}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted">
                  No votes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/votes" page={page} pageSize={PAGE_SIZE} total={total} params={{}} />
    </>
  );
}
