import type { ActivityDay } from "@/lib/types";

// Dependency-free SVG charts. Colors come from the design tokens so they follow
// light/dark mode; every chart has a text alternative.

export function ActivityChart({ data }: { data: ActivityDay[] }) {
  const width = 640;
  const height = 200;
  const pad = { top: 8, right: 8, bottom: 24, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.posts, d.votes]));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.36);
  const totalPosts = data.reduce((sum, d) => sum + d.posts, 0);
  const totalVotes = data.reduce((sum, d) => sum + d.votes, 0);
  const y = (value: number) => pad.top + innerH - (value / niceMax) * innerH;
  const label = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Daily activity for the last ${data.length} days: ${totalPosts} posts and ${totalVotes} votes in total.`}
        className="h-auto w-full"
      >
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(niceMax * fraction);
          return (
            <g key={fraction}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--line)"
              />
              <text x={pad.left - 6} y={y(value) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                {value}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + i * slot + slot / 2;
          return (
            <g key={d.day}>
              <title>{`${label(d.day)}: ${d.posts} posts, ${d.votes} votes`}</title>
              <rect
                x={x - barW - 0.5}
                y={y(d.posts)}
                width={barW}
                height={pad.top + innerH - y(d.posts)}
                rx="1.5"
                fill="var(--glow)"
              />
              <rect
                x={x + 0.5}
                y={y(d.votes)}
                width={barW}
                height={pad.top + innerH - y(d.votes)}
                rx="1.5"
                fill="var(--coral)"
              />
            </g>
          );
        })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((i, idx, arr) => data[i] && arr.indexOf(i) === idx)
          .map((i) => (
            <text
              key={i}
              x={pad.left + i * slot + slot / 2}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="var(--muted)"
            >
              {label(data[i].day)}
            </text>
          ))}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-glow" /> Posts
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-coral" /> Votes
        </span>
      </figcaption>
    </figure>
  );
}

export function VoteSplit({ up, down }: { up: number; down: number }) {
  const total = up + down;
  const upPct = total === 0 ? 0 : Math.round((up / total) * 100);
  return (
    <div>
      <div
        role="img"
        aria-label={`${up} upvotes and ${down} downvotes (${upPct}% positive)`}
        className="flex h-4 overflow-hidden rounded-full bg-line"
      >
        {total > 0 && (
          <>
            <div className="bg-glow" style={{ width: `${(up / total) * 100}%` }} />
            <div className="bg-coral" style={{ width: `${(down / total) * 100}%` }} />
          </>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-glow" /> Upvotes
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{up}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-coral" /> Downvotes
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{down}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        {total === 0 ? "No votes yet." : `${upPct}% of votes are positive.`}
      </p>
    </div>
  );
}

export function BarList({
  items,
}: {
  items: { key: string; label: string; sub?: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{item.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-glow"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          {item.sub && <p className="mt-0.5 truncate text-xs text-muted">{item.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
