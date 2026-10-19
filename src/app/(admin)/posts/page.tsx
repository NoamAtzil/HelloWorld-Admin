import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDate, one, pageNumber } from "@/lib/format";
import type { PostRow } from "@/lib/types";
import { Notice, PageHeader } from "@/components/admin/page-header";
import { Pagination, SearchForm } from "@/components/admin/table-controls";

const PAGE_SIZE = 15;
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "top", label: "Top rated" },
];

export default async function PostsPage(props: PageProps<"/posts">) {
  const { supabase } = await requireAdmin();
  const params = await props.searchParams;

  const q = (one(params.q) ?? "").trim().slice(0, 100);
  const requestedSort = one(params.sort) ?? "newest";
  const sort = SORTS.some((s) => s.value === requestedSort) ? requestedSort : "newest";
  const page = pageNumber(params.page);
  const notice = one(params.notice);
  const orphanPath = (one(params.path) ?? "").slice(0, 200);

  const { data, error } = await supabase.rpc("admin_posts", {
    p_search: q,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) console.error("admin_posts failed:", error);
  const rows = (data ?? []) as PostRow[];
  const total = rows[0]?.total_count ?? 0;

  const { data: signed } = await supabase.storage
    .from("post-images")
    .createSignedUrls(
      rows.map((row) => row.image_path),
      60 * 60,
    );
  const imageUrls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  return (
    <>
      <PageHeader
        title="AI Media"
        description="Every generated post in the app."
        actions={
          <Link href="/posts/new" className="btn-primary">
            New post
          </Link>
        }
      />

      {notice === "deleted" && <Notice tone="ok">Post deleted, including its image and votes.</Notice>}
      {notice === "image-not-removed" && (
        <Notice tone="warn">
          The post and its votes were deleted, but its image file could not be removed from
          Storage and may still exist
          {orphanPath ? <> (<code className="font-mono text-xs">{orphanPath}</code>)</> : null}.
          Remove it manually in Supabase Storage.
        </Notice>
      )}

      <SearchForm
        basePath="/posts"
        q={q}
        sort={sort}
        sortOptions={SORTS}
        placeholder="Search caption, prompt, or author"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load posts. Please refresh the page.
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Post</th>
              <th scope="col">Author</th>
              <th scope="col" className="text-right">Score</th>
              <th scope="col">Created</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post) => {
              const url = imageUrls.get(post.image_path);
              return (
                <tr key={post.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded-lg bg-tint-2" />
                      )}
                      <span className="line-clamp-2 min-w-[12rem] max-w-sm font-medium">{post.content}</span>
                    </div>
                  </td>
                  <td>
                    <span className="block">{post.author_name}</span>
                    <span className="block text-xs text-muted">{post.author_email ?? ""}</span>
                  </td>
                  <td className="text-right">
                    <span className="block font-semibold tabular-nums">
                      {post.score > 0 ? `+${post.score}` : post.score}
                    </span>
                    <span className="block text-xs text-muted">
                      ▲{post.upvotes} ▼{post.downvotes}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDate(post.created_at)}</td>
                  <td className="text-right">
                    <Link href={`/posts/${post.id}`} className="btn-quiet">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted">
                  {q ? "No posts match that search." : "No posts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/posts"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        params={{ q: q || undefined, sort: sort === "newest" ? undefined : sort }}
      />
    </>
  );
}
