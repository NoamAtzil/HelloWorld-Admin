"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveImage } from "./images-actions";
import type { ResourceFormState } from "./actions";

export function ImageForm({
  id,
  values,
  currentUrl,
}: {
  id?: number;
  values?: { title: string; description: string; is_active: boolean };
  currentUrl?: string;
}) {
  const [state, formAction, pending] = useActionState<ResourceFormState, FormData>(saveImage, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium">
          {id ? "Replace image" : "Image"}{" "}
          <span className="font-normal text-muted">
            ({id ? "optional, " : ""}JPEG, PNG or WebP, up to 4 MB)
          </span>
        </label>
        {currentUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="h-28 w-28 rounded-xl object-cover" />
        )}
        <input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={!id}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-tint file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-text"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <input id="title" name="title" required maxLength={120} defaultValue={values?.title ?? ""} className="field" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="description" name="description" maxLength={500} rows={3} defaultValue={values?.description ?? ""} className="field" />
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="is_active" defaultChecked={values?.is_active ?? true} className="h-5 w-5 accent-[var(--accent)]" />
        Active
      </label>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">{state.error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : id ? "Save changes" : "Upload image"}
        </button>
        <Link href="/manage/images" className="btn-quiet">Cancel</Link>
      </div>
    </form>
  );
}
