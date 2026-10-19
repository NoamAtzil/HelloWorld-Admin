import { requireAdmin } from "@/lib/admin";
import { Brand } from "@/components/admin/brand";
import { Sidebar } from "@/components/admin/sidebar";
import { SignOutButton } from "@/components/admin/sign-out-button";

// The shell. This check keeps non-admins from seeing the chrome, but it is NOT
// the security boundary: layouts do not re-run on client navigations, so every
// page and server action below calls requireAdmin() itself, and the database
// functions verify superadmin status again.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { email } = await requireAdmin();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-8 lg:py-6">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:h-fit lg:w-56 lg:shrink-0 lg:gap-6">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <div className="lg:hidden">
            <SignOutButton />
          </div>
        </div>
        <Sidebar />
        <div className="hidden flex-col gap-2 border-t border-line pt-4 lg:flex">
          <p className="truncate text-xs text-muted" title={email}>
            {email}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 pb-16">{children}</main>
    </div>
  );
}
