// Shown inside the admin shell while a page loads. Purely visual.
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
