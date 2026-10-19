"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePost } from "../actions";

export function DeletePost({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function confirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await deletePost(id);
      if (result.status === "deleted") {
        router.push("/posts?notice=deleted");
      } else if (result.status === "deleted_image_not_removed") {
        // The database row is already gone; say so, and say the file remains.
        router.push(`/posts?notice=image-not-removed&path=${encodeURIComponent(result.path)}`);
      } else {
        setError(result.message);
        busy.current = false;
        setPending(false);
      }
    } catch {
      setError("Couldn't reach the server. The post may not have been deleted; check the list.");
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Deleting a post also removes all of its votes and its image. This can&apos;t be undone.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm delete">
          <button type="button" onClick={confirmDelete} disabled={pending} className="btn-danger">
            {pending ? "Deleting…" : "Yes, delete this post"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="btn-quiet"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setConfirming(true)} className="btn-quiet">
            Delete post…
          </button>
        </div>
      )}
    </div>
  );
}
