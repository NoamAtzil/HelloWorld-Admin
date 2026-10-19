"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, requireAdmin } from "@/lib/admin";

export type PostFormState = { error?: string; ok?: boolean } | undefined;

export type DeleteResult =
  | { status: "deleted" }
  // The database row (and its votes) is gone, but the image file could not be
  // removed from Storage. Reported honestly; the row is NOT restored.
  | { status: "deleted_image_not_removed"; path: string }
  | { status: "error"; message: string };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_PROMPT = "Added by an administrator";

function parseText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

// Identify the real image type from its leading bytes, not the file name.
function detectImageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: "image/png", ext: "png" };
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mimeType: "image/webp", ext: "webp" };
  }
  return null;
}

// CREATE. An admin creates a post as themselves, through the same
// "create your own generation" policy every user has; no special privilege.
export async function createPost(
  _previous: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const { supabase, userId } = await requireAdmin();

  const content = parseText(formData.get("content"));
  const prompt = parseText(formData.get("prompt")) || DEFAULT_PROMPT;
  if (content.length < 1 || content.length > 500) {
    return { error: "The caption must be 1–500 characters." };
  }
  if (prompt.length > 200) {
    return { error: "The prompt must be 200 characters or fewer." };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "That image is too large. The limit is 4 MB." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return { error: "Unsupported file type. Use a JPEG, PNG, or WebP image." };
  }

  const imagePath = `${userId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(imagePath, bytes, { contentType: type.mimeType });
  if (uploadError) {
    console.error("Admin image upload failed:", uploadError);
    return { error: "The image couldn't be uploaded. Please try again." };
  }

  const { data: created, error: insertError } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      prompt,
      content,
      image_path: imagePath,
      model: "admin",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("Admin post insert failed:", insertError);
    // Best effort: don't leave the just-uploaded file behind.
    const { error: cleanupError } = await supabase.storage
      .from("post-images")
      .remove([imagePath]);
    if (cleanupError) console.error("Cleanup of uploaded image failed:", cleanupError);
    return { error: "The post couldn't be saved. Please try again." };
  }

  revalidatePath("/posts");
  revalidatePath("/");
  redirect(`/posts/${created.id}?notice=created`);
}

// UPDATE: caption and prompt only, through admin_update_post (which re-checks
// superadmin status inside the database).
export async function updatePost(
  _previous: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const { supabase } = await requireAdmin();

  const id = Number(formData.get("id"));
  const content = parseText(formData.get("content"));
  const prompt = parseText(formData.get("prompt"));

  if (!Number.isInteger(id) || id < 1) return { error: "That post no longer exists." };
  if (content.length < 1 || content.length > 500) {
    return { error: "The caption must be 1–500 characters." };
  }
  if (prompt.length < 1 || prompt.length > 200) {
    return { error: "The prompt must be 1–200 characters." };
  }

  const { error } = await supabase.rpc("admin_update_post", {
    p_id: id,
    p_content: content,
    p_prompt: prompt,
  });
  if (error) {
    console.error("admin_update_post failed:", error);
    return { error: friendlyError(error) };
  }

  revalidatePath(`/posts/${id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

// DELETE in two separate steps, reported separately:
//   1. delete the database row (votes cascade) via admin_delete_post;
//   2. remove the image from Storage.
// If step 2 fails the row is NOT restored and we say exactly that.
export async function deletePost(id: number): Promise<DeleteResult> {
  const { supabase } = await requireAdmin();

  if (!Number.isInteger(id) || id < 1) {
    return { status: "error", message: "That post no longer exists." };
  }

  const { data: imagePath, error } = await supabase.rpc("admin_delete_post", {
    p_id: id,
  });
  if (error) {
    console.error("admin_delete_post failed:", error);
    return { status: "error", message: friendlyError(error) };
  }

  revalidatePath("/posts");
  revalidatePath("/votes");
  revalidatePath("/");

  if (typeof imagePath !== "string" || imagePath === "") {
    return { status: "deleted" };
  }

  const { data: removed, error: removeError } = await supabase.storage
    .from("post-images")
    .remove([imagePath]);

  // Storage reports "nothing removed" without an error when a policy hides the
  // object, so check the returned list too.
  if (removeError || !removed || removed.length === 0) {
    console.error("Deleting post image failed:", removeError, imagePath);
    return { status: "deleted_image_not_removed", path: imagePath };
  }

  return { status: "deleted" };
}
