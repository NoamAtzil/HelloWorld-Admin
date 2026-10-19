import Link from "next/link";

// Same stretched-letter wordmark as the public app, plus an "Admin" tag.
export function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Admin home">
      <span className="text-xl font-semibold tracking-tight">
        capti
        <span
          aria-hidden="true"
          className="mx-[0.1em] inline-block text-accent-text"
          style={{ transform: "scaleX(1.6) skewX(-6deg)", transformOrigin: "50% 85%" }}
        >
          o
        </span>
        n
      </span>
      <span className="rounded-md bg-tint px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-accent-text">
        Admin
      </span>
    </Link>
  );
}
