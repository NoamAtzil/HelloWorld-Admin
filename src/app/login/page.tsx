import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/admin/brand";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Already signed in: requireAdmin() on "/" decides between the dashboard and
  // the no-access page.
  if (data?.claims) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="flex flex-col items-center gap-6 glass rounded-3xl p-8 text-center">
        <Brand />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Admin sign-in</h1>
          <p className="text-sm text-muted">
            Sign in with Google. Access is limited to administrators.
          </p>
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
