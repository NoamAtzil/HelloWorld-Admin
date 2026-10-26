"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { detectImageType } from "@/lib/image";
import type { ResourceFormState } from "./actions";

const BUCKET = "library-images";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type Validated = { bytes: Uint8Array; mimeType: string; ext: string };

// Real file checks: size, then the actual image type from its leading bytes
// (not the name or the browser's claim).
async function readImage(value: FormDataEntryValue | null): Promise<Validated | { error: string } | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_IMAGE_BYTES) return { error: "That image is too large. The limit is 4 MB." };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { error: "Unsupported file type. Use a JPEG, PNG, or WebP image." };
  return { bytes, ...type };
}

function readText(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (title.length < 1 || title.length > 120) return { error: "The title must be 1–120 characters." };
  if (description.length > 500) return { error: "The description must be 500 characters or fewer." };
  return { title, description: description || null, is_active: formData.get("is_active") === "on" };
}

// The storage name is generated here ("<uuid>.<ext>"); the client never
// chooses a path.
export async function saveImage(
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { supabase } = await requireAdmin();

  const text = readText(formData);
  if ("error" in text) return text;

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  if (idRaw && (!Number.isInteger(id) || (id as number) < 1)) return { error: "That image no longer exists." };

  const image = await readImage(formData.get("file"));
  if (image && "error" in image) return image;
  if (!id && !image) return { error: "Choose an image to upload." };

  let newPath: string | null = null;
  let orphan = false;
  if (image && !("error" in image)) {
    newPath = `${randomUUID()}.${image.ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, image.bytes, { contentType: image.mimeType });
    if (error) {
      console.error("Library image upload failed:", error);
      return { error: "The image couldn't be uploaded. Please try again." };
    }
  }

  if (!id) {
    const { error } = await supabase.from("images").insert({ ...text, storage_path: newPath });
    if (error) {
      console.error("Saving image row failed:", error);
      if (newPath) await supabase.storage.from(BUCKET).remove([newPath]);
      return { error: "The image couldn't be saved. Please try again." };
    }
  } else {
    const { data: existing } = await supabase.from("images").select("storage_path").eq("id", id).maybeSingle();
    if (!existing) {
      if (newPath) await supabase.storage.from(BUCKET).remove([newPath]);
      return { error: "That image no longer exists." };
    }
    const update = newPath ? { ...text, storage_path: newPath } : text;
    const { data, error } = await supabase.from("images").update(update).eq("id", id).select("id");
    if (error || !data || data.length === 0) {
      console.error("Updating image row failed:", error);
      if (newPath) await supabase.storage.from(BUCKET).remove([newPath]);
      return { error: "The image couldn't be saved. Please try again." };
    }
    // Replaced: the old file is no longer referenced.
    if (newPath) {
      const { data: removed, error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove([existing.storage_path as string]);
      if (removeError || !removed || removed.length === 0) {
        console.error("Removing replaced image file failed:", removeError, existing.storage_path);
        orphan = true;
      }
    }
  }

  revalidatePath("/manage/images");
  redirect(`/manage/images?notice=${orphan ? "saved_orphan" : id ? "saved" : "created"}`);
}

export async function deleteImage(id: number): Promise<{ ok: true; orphan?: boolean } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "That image no longer exists." };

  const { data, error } = await supabase.from("images").delete().eq("id", id).select("storage_path");
  if (error) {
    console.error("Deleting image row failed:", error);
    return { ok: false, error: "The image couldn't be deleted. Please try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "That image no longer exists." };

  revalidatePath("/manage/images");
  const path = data[0].storage_path as string;
  const { data: removed, error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
  if (removeError || !removed || removed.length === 0) {
    console.error("Deleting image file failed:", removeError, path);
    return { ok: true, orphan: true };
  }
  return { ok: true };
}
