import { requireAdmin } from "@/lib/admin";
import { formatNumber } from "@/lib/format";
import type { StudioStats } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { Card, StatCard } from "@/components/admin/stat-card";
import { ActivityChart, BarList } from "@/components/admin/charts";

const VOICE_NAMES: Record<string, string> = {
  classic: "Classic",
  roast: "Roast Master",
  noir: "Noir Detective",
  nature: "Nature Doc",
  grandma: "Passive-Aggressive Grandma",
  hype: "Sports Announcer",
};

export default async function ActivityPage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.rpc("admin_studio_stats");
  if (error || !data) {
    console.error("admin_studio_stats failed:", error);
    return (
      <>
        <PageHeader title="Studio activity" />
        <p role="alert" className="rounded-xl border border-coral/25 bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load the statistics. The Studio database setup (the public app&apos;s migration 004 and this
          app&apos;s migration 002) may not be applied yet.
        </p>
      </>
    );
  }
  const stats = data as StudioStats;
  const { today, caps } = stats;
  const guestUsed = Math.min(100, Math.round((today.guest_calls / Math.max(1, caps.guest_global)) * 100));
  const totalUsed = Math.min(100, Math.round((today.total_calls / Math.max(1, caps.global_daily)) * 100));

  return (
    <>
      <PageHeader
        title="Studio activity"
        description="AI usage against your daily limits, plus Arena and Daily Drop activity. Days roll over at 00:00 UTC."
      />

      {!stats.quota_configured && (
        <p role="alert" className="rounded-xl border border-coral/25 bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Guest generation is switched off: the quota secret isn&apos;t set in the database yet (see migration 004,
          section 8). Signed-in members are not affected.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Guest captions today" value={formatNumber(today.guest_calls)} hint={`of ${caps.guest_global} allowed · ${today.guest_visitors} visitors`} index={0} />
        <StatCard label="Member AI calls today" value={formatNumber(today.user_calls)} hint={`${today.users_active} members · ${caps.user_daily} each`} index={1} />
        <StatCard label="Arena battles" value={formatNumber(stats.arena.battles)} hint={`${stats.arena.judges} judges`} index={2} />
        <StatCard label="Drop entries today" value={formatNumber(stats.content.drop_entries_today)} hint={`${stats.content.drop_entries} all time`} index={3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="AI calls, last 14 days" className="lg:col-span-2">
          <ActivityChart
            data={stats.usage_by_day.map((d) => ({ day: d.day, posts: d.guest, votes: d.members }))}
            labels={["Guests", "Members"]}
          />
        </Card>
        <Card title="Today against the limits">
          <div className="flex flex-col gap-5">
            <Meter label="Guest budget" used={today.guest_calls} cap={caps.guest_global} pct={guestUsed} />
            <Meter label="All AI calls" used={today.total_calls} cap={caps.global_daily} pct={totalUsed} />
            <p className="text-xs text-muted">
              Limits live in <code className="font-mono">private.app_settings</code> and can be changed in the SQL
              editor without a deploy. Each visitor gets {caps.guest_per_visitor} guest captions a day.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Voices people publish with">
          {stats.voices.length === 0 ? (
            <EmptyState icon="posts" title="No voice data yet" compact>
              Posts published from the new Studio record the voice that wrote them.
            </EmptyState>
          ) : (
            <BarList
              items={stats.voices.map((v) => ({
                key: v.voice,
                label: VOICE_NAMES[v.voice] ?? v.voice,
                value: v.posts,
              }))}
            />
          )}
        </Card>
        <Card title="Arena battles, last 14 days">
          {stats.arena.battles === 0 ? (
            <EmptyState icon="votes" title="No battles yet" compact>
              Battles appear once members start judging captions.
            </EmptyState>
          ) : (
            <ActivityChart
              data={stats.arena.by_day.map((d) => ({ day: d.day, posts: d.battles, votes: 0 }))}
              labels={["Battles", "—"]}
            />
          )}
        </Card>
      </div>

      <Card title="Public sharing">
        <p className="text-sm text-muted">
          <span className="text-2xl font-bold tabular-nums text-ink">{formatNumber(stats.content.public_posts)}</span>{" "}
          {stats.content.public_posts === 1 ? "post is" : "posts are"} shared publicly. Authors opt in when they publish;
          no historical post was made public by the migration.
        </p>
      </Card>
    </>
  );
}

function Meter({ label, used, cap, pct }: { label: string; used: number; cap: number; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {used} / {cap}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${used} of ${cap} used today`}
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-coral" : "bg-glow"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
