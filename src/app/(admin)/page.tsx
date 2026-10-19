import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Overview } from "@/lib/types";
import { PageHeader } from "@/components/admin/page-header";
import { Card, StatCard } from "@/components/admin/stat-card";
import { ActivityChart, BarList, VoteSplit } from "@/components/admin/charts";

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.rpc("admin_overview");
  if (error || !data) {
    console.error("admin_overview failed:", error);
    return (
      <>
        <PageHeader title="Dashboard" />
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load the statistics. Please refresh the page.
        </p>
      </>
    );
  }
  const stats = data as Overview;

  // The bucket is private: sign thumbnails for the top posts in one call.
  const { data: signed } = await supabase.storage
    .from("post-images")
    .createSignedUrls(
      stats.top_posts.map((post) => post.image_path),
      60 * 60,
    );
  const imageUrls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));

  const votesPerPost = stats.posts === 0 ? 0 : stats.votes / stats.posts;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live look at the caption app: who's posting, what's landing, and what's new."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={formatNumber(stats.users)} />
        <StatCard label="AI posts" value={formatNumber(stats.posts)} hint={`${formatNumber(stats.posts_without_votes)} with no votes`} />
        <StatCard label="Votes" value={formatNumber(stats.votes)} hint={`${votesPerPost.toFixed(1)} per post`} />
        <StatCard
          label="Positive votes"
          value={stats.votes === 0 ? "—" : `${Math.round((stats.upvotes / stats.votes) * 100)}%`}
          hint={`${formatNumber(stats.upvotes)} up · ${formatNumber(stats.downvotes)} down`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Activity, last 30 days" className="lg:col-span-2">
          <ActivityChart data={stats.activity_by_day} />
        </Card>
        <Card title="Upvotes vs downvotes">
          <VoteSplit up={stats.upvotes} down={stats.downvotes} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top-rated posts">
          {stats.top_posts.length === 0 ? (
            <p className="text-sm text-muted">No posts yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {stats.top_posts.map((post, index) => {
                const thumb = imageUrls.get(post.image_path);
                return (
                <li key={post.id}>
                  <Link
                    href={`/posts/${post.id}`}
                    className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-tint/60"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted">
                      {index + 1}
                    </span>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-lg bg-tint-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium">{post.content}</span>
                      <span className="block truncate text-xs text-muted">by {post.author}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-semibold tabular-nums">
                        {post.score > 0 ? `+${post.score}` : post.score}
                      </span>
                      <span className="block text-xs text-muted">
                        ▲{post.upvotes} ▼{post.downvotes}
                      </span>
                    </span>
                  </Link>
                </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Most active users">
            {stats.active_users.length === 0 ? (
              <p className="text-sm text-muted">No users yet.</p>
            ) : (
              <BarList
                items={stats.active_users.map((user) => ({
                  key: user.id,
                  label: user.name,
                  sub: `${user.posts} posts · ${user.votes} votes`,
                  value: user.posts + user.votes,
                }))}
              />
            )}
          </Card>

          <Card title="Recent activity">
            {stats.recent_activity.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 text-sm">
                {stats.recent_activity.map((item, index) => (
                  <li key={`${item.kind}-${item.occurred_at}-${index}`} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                        item.kind === "post" ? "bg-tint text-accent-text" : "bg-coral-tint text-coral-text"
                      }`}
                    >
                      {item.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{item.actor}</span>{" "}
                      {item.kind === "post" ? (
                        <>
                          posted{" "}
                          <Link href={`/posts/${item.post_id}`} className="text-accent-text underline-offset-2 hover:underline">
                            “{item.detail.length > 60 ? `${item.detail.slice(0, 60)}…` : item.detail}”
                          </Link>
                        </>
                      ) : (
                        <>
                          {item.detail}{" "}
                          <Link href={`/posts/${item.post_id}`} className="text-accent-text underline-offset-2 hover:underline">
                            post #{item.post_id}
                          </Link>
                        </>
                      )}
                    </span>
                    <time className="shrink-0 text-xs text-muted" dateTime={item.occurred_at}>
                      {formatDateTime(item.occurred_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
