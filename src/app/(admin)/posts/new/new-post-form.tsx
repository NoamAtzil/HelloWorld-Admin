"use client";

import { useActionState } from "react";
import { createPost, type PostFormState } from "../actions";

export function NewPostForm() {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    createPost,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className="text-sm font-medium">
          Image <span className="font-normal text-muted">(JPEG, PNG or WebP, up to 4 MB)</span>
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-tint file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-text"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          Caption
        </label>
        <textarea
          id="content"
          name="content"
          required
          maxLength={500}
          rows={3}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          Prompt <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="prompt" name="prompt" maxLength={200} className="field" />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creating…" : "Create post"}
        </button>
      </div>
    </form>
  );
}
