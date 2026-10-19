"use client";

import { useActionState } from "react";
import { updatePost, type PostFormState } from "../actions";

export function EditPostForm({
  id,
  content,
  prompt,
}: {
  id: number;
  content: string;
  prompt: string;
}) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    updatePost,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          Caption
        </label>
        <textarea
          id="content"
          name="content"
          required
          maxLength={500}
          rows={4}
          defaultValue={content}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          Prompt
        </label>
        <input
          id="prompt"
          name="prompt"
          required
          maxLength={200}
          defaultValue={prompt}
          className="field"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl bg-ok-tint px-3 py-2 text-sm font-medium text-ok-text">
          Saved.
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
