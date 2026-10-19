import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import type { PostRow } from "@/lib/types";
import { Notice, PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/admin/stat-card";
import { DeletePost } from "./delete-post";
import { EditPostForm } from "./edit-post-form";

export default async function PostDetailPage(props: PageProps<"/posts/[id]">) {
  const { supabase } = await requireAdmin();

  const { id: rawId } = await props.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const notice = (await props.searchParams).notice;

  const { data, error } = await supabase.rpc("admin_posts", { p_id: id, p_limit: 1 });
  if (error) {
    console.error("admin_posts (detail) failed:", error);
    return (
      <>
        <PageHeader title="Post" />
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load this post. Please refresh the page.
        </p>
      </>
    );
  }
  const post = ((data ?? []) as PostRow[])[0];
  if (!post) notFound();

  const { data: signed } = await supabase.storage
    .from("post-images")
    .createSignedUrl(post.image_path, 60 * 60);

  return (
    <>
      <PageHeader
        title={`Post #${post.id}`}
        description={`By ${post.author_name} · ${formatDateTime(post.created_at)}`}
        actions={
          <Link href="/posts" className="btn-quiet">
            Back to AI Media
          </Link>
        }
      />

      {notice === "created" && <Notice tone="ok">Post created.</Notice>}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-tint-2 shadow-card">
            {signed?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signed.signedUrl} alt={post.content} className="max-h-[36rem] w-full object-contain" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-sm text-muted">
                Image unavailable
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Author</dt>
              <dd className="min-w-0 truncate">{post.author_name}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="min-w-0 truncate">{post.author_email ?? "—"}</dd>
              <dt className="text-muted">Model</dt>
              <dd>{post.model}</dd>
              <dt className="text-muted">Score</dt>
              <dd className="font-semibold tabular-nums">
                {post.score > 0 ? `+${post.score}` : post.score}{" "}
                <span className="font-normal text-muted">
                  (▲{post.upvotes} ▼{post.downvotes})
                </span>
              </dd>
              <dt className="text-muted">Image path</dt>
              <dd className="min-w-0 break-all font-mono text-xs">{post.image_path}</dd>
            </dl>
          </Card>

          <Card title="Edit caption">
            <EditPostForm id={post.id} content={post.content} prompt={post.prompt} />
          </Card>

          <Card title="Danger zone">
            <DeletePost id={post.id} />
          </Card>
        </div>
      </div>
    </>
  );
}
