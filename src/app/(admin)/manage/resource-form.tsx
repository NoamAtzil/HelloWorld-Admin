"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Field } from "@/lib/resources";
import { saveResource, type ResourceFormState } from "./actions";

export type FormOptions = Record<string, { value: string; label: string }[]>;

export function ResourceForm({
  resourceKey,
  fields,
  values,
  id,
  options,
}: {
  resourceKey: string;
  fields: Field[];
  values: Record<string, unknown>;
  id?: number;
  options: FormOptions;
}) {
  const [state, formAction, pending] = useActionState<ResourceFormState, FormData>(saveResource, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="resource" value={resourceKey} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const wide = field.type === "textarea";
          const value = values[field.name] ?? field.defaultValue ?? (field.type === "boolean" ? false : "");
          const inputId = `f-${field.name}`;
          return (
            <div key={field.name} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
              {field.type === "boolean" ? (
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <input
                    id={inputId}
                    type="checkbox"
                    name={field.name}
                    defaultChecked={Boolean(value)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  <label htmlFor={inputId} className="text-sm font-medium">
                    {field.label}
                    {!field.required && <span className="font-normal text-muted"> (optional)</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={inputId}
                      name={field.name}
                      defaultValue={String(value)}
                      required={field.required}
                      maxLength={field.max}
                      rows={4}
                      placeholder={field.placeholder}
                      className="field"
                    />
                  ) : field.type === "select" ? (
                    <select id={inputId} name={field.name} defaultValue={String(value)} required={field.required} className="field">
                      {!field.required && <option value="">—</option>}
                      {field.required && value === "" && <option value="">Choose…</option>}
                      {(field.options ?? options[field.name] ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      name={field.name}
                      type={field.type === "number" ? "number" : "text"}
                      defaultValue={String(value)}
                      required={field.required}
                      maxLength={field.type === "text" ? field.max : undefined}
                      min={field.type === "number" ? field.min : undefined}
                      max={field.type === "number" ? field.max : undefined}
                      step={field.type === "number" ? 1 : undefined}
                      placeholder={field.placeholder}
                      autoComplete="off"
                      className="field"
                    />
                  )}
                </>
              )}
              {field.help && <p className="text-xs text-muted">{field.help}</p>}
            </div>
          );
        })}
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : id ? "Save changes" : "Create"}
        </button>
        <Link href={`/manage/${resourceKey}`} className="btn-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}
