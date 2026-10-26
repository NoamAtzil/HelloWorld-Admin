"use server";

import { revalidatePath } from "next/cache";
import { friendlyError, requireAdmin } from "@/lib/admin";

export type ChallengeFormState = { error?: string; ok?: string } | undefined;

const SLUG = /^[A-Za-z0-9._-]{1,120}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Pin a library image (and optional theme) to a future day. The database
// function re-checks superadmin status and refuses today or past dates.
export async function saveChallenge(
  _previous: ChallengeFormState,
  formData: FormData,
): Promise<ChallengeFormState> {
  const { supabase } = await requireAdmin();

  const date = String(formData.get("date") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();
  const theme = String(formData.get("theme") ?? "").trim();

  if (!DATE.test(date)) return { error: "Choose a date." };
  if (!SLUG.test(slug)) return { error: "Enter the library image file name, for example 03-chasing-the-1-train.jpg." };
  if (theme.length > 80) return { error: "The theme must be 80 characters or fewer." };

  const { error } = await supabase.rpc("admin_set_challenge", {
    p_date: date,
    p_slug: slug,
    p_theme: theme || null,
  });
  if (error) {
    console.error("admin_set_challenge failed:", error);
    return { error: friendlyError(error) };
  }
  revalidatePath("/challenges");
  return { ok: `Saved for ${date}.` };
}

export async function removeChallenge(formData: FormData) {
  const { supabase } = await requireAdmin();
  const date = String(formData.get("date") ?? "");
  if (!DATE.test(date)) return;
  const { error } = await supabase.rpc("admin_delete_challenge", { p_date: date });
  if (error) console.error("admin_delete_challenge failed:", error);
  revalidatePath("/challenges");
}
