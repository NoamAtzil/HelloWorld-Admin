import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime, one, pageNumber } from "@/lib/format";
import { getResource, type Column } from "@/lib/resources";
import { EmptyState, Notice, PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/admin/stat-card";
import { Pagination } from "@/components/admin/table-controls";
import { DeleteButton } from "../delete-button";
import { ImageForm } from "../image-form";
import { ResourceForm, type FormOptions } from "../resource-form";

const PAGE_SIZE = 20;

// Dig "relation.column" out of a row (embedded rows can arrive as an object
// or a one-item array).
function read(row: Record<string, unknown>, path: string): unknown {
  let value: unknown = row;
  for (const part of path.split(".")) {
    if (Array.isArray(value)) value = value[0];
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return Array.isArray(value) ? value[0] : value;
}

function Cell({ column, row }: { column: Column; row: Record<string, unknown> }) {
  const value = read(row, column.path);
  if (value === null || value === undefined || value === "") return <span className="text-muted">—</span>;
  switch (column.kind) {
    case "bool":
      return (
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${value ? "bg-ok-tint text-ok-text" : "bg-line text-muted"}`}>
          {value ? "Yes" : "No"}
        </span>
      );
    case "date":
      return <span className="whitespace-nowrap text-muted">{formatDateTime(String(value))}</span>;
    case "mono":
      return <span className="break-all font-mono text-xs">{String(value)}</span>;
    case "clip":
      return <span className="line-clamp-2 max-w-sm">{String(value)}</span>;
    case "number":
      return <span className="tabular-nums">{String(value)}</span>;
    case "status":
      return (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            value === "ok" ? "bg-ok-tint text-ok-text" : "bg-coral-tint text-coral-text"
          }`}
        >
          {String(value)}
        </span>
      );
    default:
      return <span>{String(value)}</span>;
  }
}

// Strip characters that have meaning inside a PostgREST filter expression.
function safeSearch(value: string) {
  return value.replace(/[,()*%\\:"'`]/g, " ").trim().slice(0, 80);
}

export default async function ManagePage(props: PageProps<"/manage/[resource]">) {
  const { supabase } = await requireAdmin();

  const { resource: key } = await props.params;
  const resource = getResource(key);
  if (!resource) notFound();
  const isImages = key === "images";

  const params = await props.searchParams;
  const page = pageNumber(params.page);
  const q = safeSearch(one(params.q) ?? "");
  const notice = one(params.notice);
  const editId = Number(one(params.edit));
  const creating = one(params.new) === "1";
  const canCreate = resource.mode === "crud" || isImages;

  // ---- list --------------------------------------------------------------
  let query = supabase
    .from(isImages ? "images" : resource.table)
    .select(isImages ? "*" : resource.select, { count: "exact" })
    .order(resource.order.column, { ascending: resource.order.ascending })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const searchColumns = isImages ? ["title", "description"] : resource.searchColumns;
  if (q && searchColumns?.length) {
    query = query.or(searchColumns.map((c) => `${c}.ilike.%${q}%`).join(","));
  }
  const { data, count, error: listError } = await query;
  // A page number past the end is just an empty page, not a failure.
  const error = listError?.code === "PGRST103" ? null : listError;
  if (error) console.error(`${resource.table} list failed:`, error);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  // ---- form data -----------------------------------------------------------
  const editing = Number.isInteger(editId) && editId > 0;
  let editRow: Record<string, unknown> | null = null;
  if (editing) {
    const { data: row } = await supabase
      .from(resource.table)
      .select("*")
      .eq("id", editId)
      .maybeSingle();
    editRow = (row as Record<string, unknown> | null) ?? null;
  }
  const options: FormOptions = {};
  if ((creating || editRow) && !isImages) {
    for (const field of resource.fields) {
      if (field.fk) {
        const { data: fkRows } = await supabase
          .from(field.fk.table)
          .select(`id, ${field.fk.label}`)
          .order(field.fk.label);
        options[field.name] = ((fkRows ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
          value: String(r.id),
          label: String(r[field.fk!.label]),
        }));
      }
    }
  }

  const imageUrl = (path: unknown) =>
    typeof path === "string" ? supabase.storage.from("library-images").getPublicUrl(path).data.publicUrl : null;

  const showForm = (creating && canCreate) || (editRow && resource.mode !== "readonly");
  const total = count ?? 0;
  const columns: Column[] = isImages
    ? [
        { path: "storage_path", label: "Image", kind: "image" },
        { path: "title", label: "Title" },
        { path: "description", label: "Description", kind: "clip" },
        { path: "is_active", label: "Active", kind: "bool" },
        { path: "created_at", label: "Added", kind: "date" },
      ]
    : resource.columns;
  const canEdit = resource.mode !== "readonly";
  const canDelete = resource.mode === "crud" || isImages;

  return (
    <>
      <PageHeader
        title={isImages ? "Images" : resource.title}
        description={
          isImages
            ? "The managed image library. Uploads are checked for size and real file type and stored under generated names. Files are publicly readable by URL, even when marked inactive."
            : resource.description
        }
        actions={
          canCreate && !showForm ? (
            <Link href={`/manage/${key}?new=1`} className="btn-primary">
              {isImages ? "Upload image" : `New ${resource.singular}`}
            </Link>
          ) : undefined
        }
      />

      {resource.notice && (
        <p className="rounded-xl border border-line bg-tint px-4 py-3 text-sm text-ink">{resource.notice}</p>
      )}
      {notice === "created" && <Notice tone="ok">Created.</Notice>}
      {notice === "saved" && <Notice tone="ok">Saved.</Notice>}
      {notice === "deleted" && <Notice tone="ok">Deleted.</Notice>}
      {(notice === "deleted_orphan" || notice === "saved_orphan") && (
        <Notice tone="warn">
          {notice === "deleted_orphan" ? "The record was deleted" : "Saved"}, but a file could not be removed from Storage and
          may still exist in the library-images bucket. Remove it manually in Supabase Storage.
        </Notice>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-coral/25 bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Couldn&apos;t load this list. The database setup for it (migrations 005 and admin 003) may not be applied yet.
        </p>
      )}
      {editing && !editRow && !showForm && <Notice tone="warn">That record no longer exists.</Notice>}

      {showForm && (
        <Card title={editRow ? `Edit ${resource.singular}` : isImages ? "Upload an image" : `New ${resource.singular}`}>
          {isImages ? (
            <ImageForm
              id={editRow ? (editRow.id as number) : undefined}
              currentUrl={editRow ? (imageUrl(editRow.storage_path) ?? undefined) : undefined}
              values={
                editRow
                  ? {
                      title: String(editRow.title ?? ""),
                      description: String(editRow.description ?? ""),
                      is_active: Boolean(editRow.is_active),
                    }
                  : undefined
              }
            />
          ) : (
            <ResourceForm
              resourceKey={key}
              fields={resource.fields}
              values={editRow ?? {}}
              id={editRow ? (editRow.id as number) : undefined}
              options={options}
            />
          )}
        </Card>
      )}

      {searchColumns?.length ? (
        <form method="get" action={`/manage/${key}`} role="search" className="flex flex-wrap items-center gap-2">
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search…" className="field min-w-0 flex-1 sm:max-w-xs" />
          <button type="submit" className="btn-primary">Search</button>
          {q && <Link href={`/manage/${key}`} className="btn-quiet">Clear</Link>}
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.path} scope="col" className={c.align === "right" ? "text-right" : undefined}>
                  {c.label}
                </th>
              ))}
              {(canEdit || canDelete) && (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((c, i) => (
                  <td
                    key={c.path}
                    data-label={i === 0 ? undefined : c.label}
                    className={`${i === 0 ? "cell-main" : ""} ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.kind === "image" ? (
                      imageUrl(row[c.path]) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl(row[c.path])!} alt={String(row.title ?? "")} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
                      ) : null
                    ) : (
                      <Cell column={c} row={row} />
                    )}
                  </td>
                ))}
                {(canEdit || canDelete) && (
                  <td className="text-right">
                    <span className="flex flex-wrap items-start justify-end gap-2">
                      {canEdit && (
                        <Link href={`/manage/${key}?edit=${row.id}`} className="btn-quiet min-h-9 px-3">
                          Edit
                        </Link>
                      )}
                      {canDelete && (
                        <DeleteButton
                          resourceKey={key}
                          id={row.id as number}
                          label={String(read(row, columns[0].path === "storage_path" ? "title" : columns[0].path) ?? resource.singular)}
                          warning={resource.deleteWarning}
                        />
                      )}
                    </span>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="cell-empty">
                  <EmptyState icon={q ? "search" : "posts"} title={q ? "No matches" : "Nothing here yet"}>
                    {q ? "Try a different search." : isImages ? "Upload the first image." : resource.empty}
                  </EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath={`/manage/${key}`} page={page} pageSize={PAGE_SIZE} total={total} params={{ q: q || undefined }} />
    </>
  );
}
