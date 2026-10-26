import { Sparkline } from "./charts";

export function StatCard({
  label,
  value,
  hint,
  spark,
  index = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Optional recent trend, drawn as a decorative sparkline. */
  spark?: number[];
  /** Position in a row, for the staggered entrance. */
  index?: number;
}) {
  return (
    <div
      className="panel rise relative overflow-hidden rounded-2xl p-4"
      style={{ "--i": index } as React.CSSProperties}
    >
      {/* A faint orange edge light, top-left. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-glow/20 blur-2xl"
      />
      <p className="relative text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      {hint && <p className="relative mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel rounded-2xl p-4 sm:p-5 ${className}`}>
      {title && <h2 className="mb-4 text-base font-semibold tracking-tight">{title}</h2>}
      {children}
    </section>
  );
}
