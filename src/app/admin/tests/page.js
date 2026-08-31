import { AdminShell } from '../../../components/AdminShell.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { AdminPagination } from '../../../components/AdminPagination.js';
import { listRecentTestsForAdmin, countTestsForAdmin } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';
import { DeleteTestButton } from '../../../components/DeleteTestButton.js';
import { AdminSortHeader } from '../../../components/AdminSortHeader.js';
import { ChartNoAxesCombined, Eye, Flag, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — tests', robots: { index: false, follow: false } };

const PAGE_SIZE = 15;
const TEST_SORT_KEYS = new Set(['title', 'responses', 'status', 'reports', 'created']);

export default async function AdminTestsPage({ searchParams }) {
  const { key, page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  const sort = TEST_SORT_KEYS.has(sortParam) ? sortParam : 'created';
  const direction = dirParam === 'asc' ? 'asc' : 'desc';

  // Count first, clamp the requested page into range, THEN fetch that page's
  // rows — same order as /admin/users and /admin/payments, and for the same
  // reason: a stale or hand-edited `?page=` can't run past the real last page.
  const totalTests = await countTestsForAdmin();
  const totalPages = Math.max(1, Math.ceil(totalTests / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;

  const tests = await listRecentTestsForAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort, direction });

  const pageHref = (targetPage) =>
    adminHref('/admin/tests', { viaToken, key }, { sort, dir: direction, page: targetPage > 1 ? targetPage : undefined });
  const sortHref = (nextSort) =>
    adminHref('/admin/tests', { viaToken, key }, {
      sort: nextSort,
      dir: sort === nextSort && direction === 'asc' ? 'desc' : 'asc',
    });

  return (
    <AdminShell mainClassName="wrap pt-6 pb-16 space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin — Tests</h1>

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">Recent tests</h2>
          <table className="data-table mt-2 w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink">
                <AdminSortHeader active={sort === 'title'} direction={direction} href={sortHref('title')}>Title</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'responses'} direction={direction} href={sortHref('responses')}>Resp.</AdminSortHeader>
                <AdminSortHeader active={sort === 'status'} direction={direction} href={sortHref('status')}>Status</AdminSortHeader>
                <AdminSortHeader active={sort === 'reports'} direction={direction} href={sortHref('reports')}>
                  <span className="inline-flex items-center gap-1" title="Reports submitted by respondents for human review">
                    Reports <Info className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  </span>
                </AdminSortHeader>
                <th className="py-2">Open</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 && (
                <tr>
                  <td className="py-3 text-muted" colSpan={6}>
                    No tests yet.
                  </td>
                </tr>
              )}
              {tests.map((test) => (
                <tr key={test.id} className="border-b border-line">
                  <td className="py-2">{test.title}</td>
                  <td className="py-2 text-right tabular-nums">{test.response_count}</td>
                  <td className="py-2">{test.status}</td>
                  <td className="py-2">
                    {test.reported_count > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-alert">
                        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                        {test.reported_count} {test.reported_count === 1 ? 'report' : 'reports'}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {/* "results" still opens /r/<token>'s full Manage-this-test
                    * menu (pause/resume, export, delete) — kept for anything
                    * beyond delete. Delete also lives right here now so the
                    * single most common moderation action doesn't need the
                    * extra click through. */}
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <a className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-locked" href={`/r/${test.creator_token}`}>
                        <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
                        Results
                      </a>
                      <a className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-locked" href={`/t/${test.slug}`}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Respondent
                      </a>
                    </div>
                  </td>
                  <td className="py-2">
                    <DeleteTestButton token={test.creator_token} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AdminPagination page={page} totalPages={totalPages} total={totalTests} pageSize={PAGE_SIZE} buildHref={pageHref} />
        </div>

        <p className="hint">
          Reports are respondent-submitted flags for human review. Open Results to pause, export, or delete a test.
          <a className="ml-2 underline" href={pageHref(page)}>
            refresh
          </a>
        </p>
    </AdminShell>
  );
}
