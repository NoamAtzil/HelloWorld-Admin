import type { ActivityDay } from "@/lib/types";

// Dependency-free SVG charts. Colors come from the design tokens so they follow
// light/dark mode; every chart has a text alternative.

export function ActivityChart({
  data,
  labels = ["Posts", "Votes"],
}: {
  data: ActivityDay[];
  /** Names for the two series (first = orange, second = coral). */
  labels?: [string, string];
}) {
  const width = 640;
  const height = 220;
  const pad = { top: 10, right: 10, bottom: 26, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.posts, d.votes]));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const totalPosts = data.reduce((sum, d) => sum + d.posts, 0);
  const totalVotes = data.reduce((sum, d) => sum + d.votes, 0);
  const x = (i: number) => pad.left + i * step;
  const y = (value: number) => pad.top + innerH - (value / niceMax) * innerH;
  const baseline = pad.top + innerH;
  const label = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const line = (pick: (d: ActivityDay) => number) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(pick(d)).toFixed(1)}`).join(" ");
  const area = (pick: (d: ActivityDay) => number) =>
    data.length > 1
      ? `${line(pick)} L${x(data.length - 1).toFixed(1)} ${baseline} L${x(0).toFixed(1)} ${baseline} Z`
      : "";
  const hit = Math.max(8, step);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Daily activity for the last ${data.length} days: ${totalPosts} ${labels[0].toLowerCase()} and ${totalVotes} ${labels[1].toLowerCase()} in total.`}
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="activity-posts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--glow)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--glow)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="activity-votes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--coral)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--coral)" stopOpacity="0" />
          </linearGradient>
        </defs>
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
                strokeDasharray={fraction === 0 ? undefined : "3 4"}
              />
              <text x={pad.left - 6} y={y(value) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                {value}
              </text>
            </g>
          );
        })}
        {data.length > 1 && (
          <>
            <path d={area((d) => d.votes)} fill="url(#activity-votes)" />
            <path d={area((d) => d.posts)} fill="url(#activity-posts)" />
            <path
              d={line((d) => d.votes)}
              pathLength={1}
              className="chart-line"
              style={{ "--len": 1 } as React.CSSProperties}
              fill="none"
              stroke="var(--coral)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={line((d) => d.posts)}
              pathLength={1}
              className="chart-line"
              style={{ "--len": 1 } as React.CSSProperties}
              fill="none"
              stroke="var(--glow)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {data.map((d, i) => (
          <g key={d.day}>
            <title>{`${label(d.day)}: ${d.posts} ${labels[0].toLowerCase()}, ${d.votes} ${labels[1].toLowerCase()}`}</title>
            {d.posts > 0 && <circle cx={x(i)} cy={y(d.posts)} r="3" fill="var(--glow)" />}
            {d.votes > 0 && <circle cx={x(i)} cy={y(d.votes)} r="2.5" fill="var(--coral)" />}
            {/* Wide invisible target so the tooltip is easy to hit. */}
            <rect x={x(i) - hit / 2} y={pad.top} width={hit} height={innerH} fill="transparent" />
          </g>
        ))}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((i, idx, arr) => data[i] && arr.indexOf(i) === idx)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
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
          <span className="h-2.5 w-2.5 rounded-sm bg-glow" /> {labels[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-coral" /> {labels[1]}
        </span>
      </figcaption>
    </figure>
  );
}

// A tiny decorative trend line; the number it sits beside carries the meaning.
export function Sparkline({ values }: { values: number[] }) {
  const width = 84;
  const height = 32;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-[84px] shrink-0" aria-hidden="true">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--glow)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
