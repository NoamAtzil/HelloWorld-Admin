"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteResource } from "./actions";
import { deleteImage } from "./images-actions";

// Two-step delete: the first click asks, the second one does it.
export function DeleteButton({
  resourceKey,
  id,
  label,
  warning,
}: {
  resourceKey: string;
  id: number;
  label: string;
  warning?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  async function confirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = resourceKey === "images" ? await deleteImage(id) : await deleteResource(resourceKey, id);
      if (result.ok) {
        const orphan = (result as { orphan?: boolean }).orphan;
        router.push(`/manage/${resourceKey}?notice=${orphan ? "deleted_orphan" : "deleted"}`);
        router.refresh();
        return;
      }
      setMessage(result.error);
      setConfirming(false);
    } catch {
      setMessage("Couldn't reach the server. The record may not have been deleted; check the list.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex flex-col items-end gap-1.5" role="group" aria-label={`Confirm deleting ${label}`}>
        {warning && <span className="max-w-[16rem] text-right text-xs text-muted">{warning}</span>}
        <span className="flex gap-2">
          <button type="button" onClick={() => void confirmDelete()} disabled={pending} className="btn-danger min-h-9 px-3">
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn-quiet min-h-9 px-3">
            Cancel
          </button>
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setConfirming(true)} className="btn-quiet min-h-9 px-3" aria-label={`Delete ${label}`}>
        Delete
      </button>
      {message && (
        <span role="alert" className="max-w-[16rem] text-right text-xs text-coral-text">
          {message}
        </span>
      )}
    </span>
  );
}
