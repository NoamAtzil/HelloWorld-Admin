import { requireAdmin } from "@/lib/admin";
import { formatDate, formatNumber } from "@/lib/format";
import type { ChallengeRow, DropHistoryRow } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/admin/stat-card";
import { ChallengeForm } from "./challenge-form";
import { removeChallenge } from "./actions";

// Same clock as the public app and the database (public.drop_today()).
function easternToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

function tomorrow(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export default async function ChallengesPage() {
  const { supabase } = await requireAdmin();
  const today = easternToday();

  const [{ data: challengeData, error }, { data: historyData }] = await Promise.all([
    supabase.rpc("admin_challenges"),
    supabase.rpc("admin_drop_history", { p_days: 14 }),
  ]);
  if (error) console.error("admin_challenges failed:", error);
  const challenges = (challengeData ?? []) as ChallengeRow[];
  const history = (historyData ?? []) as DropHistoryRow[];

  return (
    <>
      <PageHeader
        title="Daily Drop"
        description="Each day's photo is picked automatically from the image library. Pin a specific image or theme to any future day. Days run on Eastern Time."
      />

      {error && (
        <p role="alert" className="rounded-xl border border-coral/25 bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load challenges. The Drop database setup (migration 004 and admin migration 002) may not be applied yet.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Pin a challenge" className="lg:col-span-2">
          <ChallengeForm minDate={tomorrow(today)} />
        </Card>

        <Card title="Pinned days" className="lg:col-span-3">
          {challenges.length === 0 ? (
            <EmptyState icon="posts" title="Nothing pinned" compact>
              Every day currently uses the automatic pick.
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {challenges.map((c) => (
                <li key={c.drop_date} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-28 shrink-0 font-semibold tabular-nums">{formatDate(`${c.drop_date}T12:00:00`)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs">{c.library_slug}</span>
                    <span className="block truncate text-xs text-muted">{c.theme ?? "No theme"}</span>
                  </span>
                  {c.drop_date > today ? (
                    <form action={removeChallenge}>
                      <input type="hidden" name="date" value={c.drop_date} />
                      <button type="submit" className="btn-quiet min-h-9 px-3">Remove</button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted">{formatNumber(c.entries)} entries</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-lg font-semibold tracking-tight">Recent Drops</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="text-right">Entries</th>
                <th scope="col" className="text-right">Votes</th>
                <th scope="col">Winner</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.drop_date}>
                  <td data-label="Day" className="whitespace-nowrap font-medium">{formatDate(`${row.drop_date}T12:00:00`)}</td>
                  <td data-label="Entries" className="text-right tabular-nums">{row.entries}</td>
                  <td data-label="Votes" className="text-right tabular-nums">{row.votes}</td>
                  <td data-label="Winner" className="max-w-sm">
                    {row.winner_id ? (
                      <span className="block">
                        <span className="line-clamp-2 font-medium">{row.winner_content}</span>
                        <span className="block text-xs text-muted">
                          {row.winner_author} · +{row.winner_score}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">
                        {row.drop_date === today ? "Running now" : row.entries === 0 ? "No entries" : "No winner"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="cell-empty">
                    <EmptyState icon="posts" title="No Drops yet">
                      Drops appear here once the database setup is applied.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
