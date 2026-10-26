"use client";

import { useActionState } from "react";
import { saveChallenge, type ChallengeFormState } from "./actions";

export function ChallengeForm({ minDate }: { minDate: string }) {
  const [state, formAction, pending] = useActionState<ChallengeFormState, FormData>(saveChallenge, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium">Date</label>
          <input id="date" name="date" type="date" required min={minDate} className="field" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-sm font-medium">Library image file</label>
          <input id="slug" name="slug" required maxLength={120} placeholder="03-chasing-the-1-train.jpg" className="field" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="theme" className="text-sm font-medium">
          Theme <span className="font-normal text-muted">(optional, shown on the Drop page)</span>
        </label>
        <input id="theme" name="theme" maxLength={80} placeholder="Monday mood" className="field" />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">{state.error}</p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl bg-ok-tint px-3 py-2 text-sm font-medium text-ok-text">{state.ok}</p>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Pin challenge"}
        </button>
      </div>
    </form>
  );
}
