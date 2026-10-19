import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/admin/page-header";
import { NewPostForm } from "./new-post-form";

export default async function NewPostPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="New post"
        description="Add a post by hand. It is created under your own account and no AI is called."
        actions={
          <Link href="/posts" className="btn-quiet">
            Back to AI Media
          </Link>
        }
      />
      <NewPostForm />
    </>
  );
}
