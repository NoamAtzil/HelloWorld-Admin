"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getResource, type Field, type Resource } from "@/lib/resources";

export type ResourceFormState = { error?: string } | undefined;
export type DeleteResult = { ok: true } | { ok: false; error: string };

type Payload = Record<string, string | number | boolean | null>;

// Turn the submitted form into a payload, using ONLY the fields the resource
// declares (anything else in the form is ignored) and validating each one.
function parse(resource: Resource, formData: FormData, only?: string[]): { payload: Payload } | { error: string } {
  const payload: Payload = {};
  for (const field of resource.fields) {
    if (only && !only.includes(field.name)) continue;
    const raw = formData.get(field.name);
    const result = parseField(field, raw);
    if ("error" in result) return result;
    payload[field.name] = result.value;
  }
  return { payload };
}

function parseField(field: Field, raw: FormDataEntryValue | null): { value: string | number | boolean | null } | { error: string } {
  if (field.type === "boolean") return { value: raw === "on" || raw === "true" };

  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") {
    if (field.required) return { error: `${field.label} is required.` };
    return { value: null };
  }
  if (field.type === "number") {
    const n = Number(text);
    if (!Number.isInteger(n)) return { error: `${field.label} must be a whole number.` };
    if (field.min !== undefined && n < field.min) return { error: `${field.label} must be at least ${field.min}.` };
    if (field.max !== undefined && n > field.max) return { error: `${field.label} must be at most ${field.max}.` };
    return { value: n };
  }
  if (field.type === "select" && field.options && !field.options.some((o) => o.value === text)) {
    return { error: `Choose a valid ${field.label.toLowerCase()}.` };
  }
  if (field.type === "select" && field.fk) {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) return { error: `Choose a valid ${field.label.toLowerCase()}.` };
    return { value: n };
  }
  if (field.max !== undefined && text.length > field.max) {
    return { error: `${field.label} must be ${field.max} characters or fewer.` };
  }
  return { value: text };
}

// Friendly messages for the database's own refusals (raw errors stay in logs).
function dbMessage(
  error: { code?: string; message?: string },
  resource: Resource,
  op: "save" | "delete",
): string {
  switch (error.code) {
    case "42501":
      return "You don't have permission to do that.";
    case "23505":
      return `That ${resource.singular} already exists (or another one is already the default / in that position).`;
    case "23503":
      return op === "delete"
        ? `This ${resource.singular} is still referenced by other records, such as generation history, so it can't be deleted. Deactivate it instead.`
        : "The related record you chose doesn't exist any more. Reload and try again.";
    case "23514":
      return "One of the values isn't allowed. Check the format and try again.";
    case "22001":
      return "One of the values is too long.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function resourceOr(key: FormDataEntryValue | string | null) {
  return typeof key === "string" ? getResource(key) : null;
}

export async function saveResource(
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireAdmin();

  const resource = resourceOr(formData.get("resource"));
  if (!resource || resource.mode === "readonly" || resource.key === "images") {
    return { error: "That can't be changed here." };
  }

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  if (idRaw && (!Number.isInteger(id) || (id as number) < 1)) return { error: "That record no longer exists." };
  if (resource.mode === "update-only" && !id) return { error: "That can't be created here." };

  const parsed = parse(resource, formData);
  if ("error" in parsed) return { error: parsed.error };

  let error: { code?: string; message?: string } | null;
  if (id) {
    // `.select()` so an update that matched nothing (row gone, or hidden by the
    // database's policies) is reported instead of pretending to succeed.
    const res = await supabase.from(resource.table).update(parsed.payload).eq("id", id).select("id");
    error = res.error;
    if (!error && (!res.data || res.data.length === 0)) return { error: "That record no longer exists." };
  } else {
    const res = await supabase.from(resource.table).insert(parsed.payload);
    error = res.error;
  }
  if (error) {
    console.error(`${resource.table} save failed:`, error);
    return { error: dbMessage(error, resource, "save") };
  }

  revalidatePath(`/manage/${resource.key}`);
  redirect(`/manage/${resource.key}?notice=${id ? "saved" : "created"}`);
}

export async function deleteResource(resourceKey: string, id: number): Promise<DeleteResult> {
  const { supabase } = await requireAdmin();

  const resource = resourceOr(resourceKey);
  if (!resource || resource.mode !== "crud" || resource.key === "images") {
    return { ok: false, error: "That can't be deleted here." };
  }
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "That record no longer exists." };

  const { data, error } = await supabase.from(resource.table).delete().eq("id", id).select("id");
  if (error) {
    console.error(`${resource.table} delete failed:`, error);
    return { ok: false, error: dbMessage(error, resource, "delete") };
  }
  if (!data || data.length === 0) return { ok: false, error: "That record no longer exists." };

  revalidatePath(`/manage/${resource.key}`);
  return { ok: true };
}
