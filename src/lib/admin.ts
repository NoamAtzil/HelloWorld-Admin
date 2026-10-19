import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The single admin gate. Call it at the top of EVERY admin page and EVERY
// server action (layouts do not re-run on client navigations, so a layout
// check alone is not enough). It verifies the session cryptographically and
// then asks the database, which is the real source of truth:
// public.is_superadmin() only answers for the caller's own profile flag.
//
// The database functions the admin app calls re-check this themselves, so a
// bug here can never expose data on its own.
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  const { data: isAdmin, error } = await supabase.rpc("is_superadmin");
  if (error) {
    // Most likely the migration has not been applied yet.
    redirect("/no-access?reason=setup");
  }
  if (isAdmin !== true) {
    redirect("/no-access");
  }

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  };
});

// Server actions return friendly messages; raw database errors stay in logs.
export function friendlyError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "P0002") return "That post no longer exists.";
  if (error.code === "22023") return error.message ?? "Check the values and try again.";
  return "Something went wrong. Please try again.";
}
