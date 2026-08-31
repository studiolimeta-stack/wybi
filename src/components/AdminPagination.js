/**
 * Plain server-rendered page links — no client JS, since the alternative
 * (buttons + client-side fetch) would only add a loading state for zero
 * benefit on a read-only admin table. `buildHref(targetPage)` is supplied by
 * the caller so this stays generic across /admin/users (today) and any other
 * admin table that grows a page size later, rather than hardcoding the
 * `users`-filter + `key` query-string shape one specific page happens to need.
 */
export function AdminPagination({ page, totalPages, total, pageSize, buildHref }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="hint">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-3">
        <a
          href={buildHref(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={`btn btn-plain px-3 py-2 text-sm ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
        >
          ← Prev
        </a>
        <span className="hint tabular-nums">
          Page {page} of {totalPages}
        </span>
        <a
          href={buildHref(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : undefined}
          className={`btn btn-plain px-3 py-2 text-sm ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
        >
          Next →
        </a>
      </div>
    </div>
  );
}
