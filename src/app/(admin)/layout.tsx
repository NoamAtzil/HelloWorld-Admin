import { requireAdmin } from "@/lib/admin";
import { Brand } from "@/components/admin/brand";
import { Sidebar } from "@/components/admin/sidebar";
import { SectionTabs } from "@/components/admin/section-tabs";
import { SignOutButton } from "@/components/admin/sign-out-button";

// The shell. This check keeps non-admins from seeing the chrome, but it is NOT
// the security boundary: layouts do not re-run on client navigations, so every
// page and server action below calls requireAdmin() itself, and the database
// functions verify superadmin status again.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { email } = await requireAdmin();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-3 sm:px-4 lg:flex-row lg:gap-6 lg:py-6">
      <aside className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 lg:sticky lg:top-6 lg:h-fit lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-6 lg:rounded-3xl lg:p-4">
        <Brand />
        <div className="lg:hidden">
          <SignOutButton />
        </div>
        <Sidebar variant="rail" />
        <div className="hidden flex-col gap-2 border-t border-line pt-4 lg:flex">
          <p className="truncate text-xs text-muted" title={email}>
            {email}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <Sidebar variant="tabs" />
      <main className="flex min-w-0 flex-1 flex-col gap-6 pb-28 lg:pb-16">
        <SectionTabs />
        {children}
      </main>
    </div>
  );
}
