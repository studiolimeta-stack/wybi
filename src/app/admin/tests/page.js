import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { AdminPagination } from '../../../components/AdminPagination.js';
import { listRecentTestsForAdmin, countTestsForAdmin } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';
import { DeleteTestButton } from '../../../components/DeleteTestButton.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — tests', robots: { index: false, follow: false } };

const PAGE_SIZE = 15;

export default async function AdminTestsPage({ searchParams }) {
  const { key, page: pageParam } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  // Count first, clamp the requested page into range, THEN fetch that page's
  // rows — same order as /admin/users and /admin/payments, and for the same
  // reason: a stale or hand-edited `?page=` can't run past the real last page.
  const totalTests = await countTestsForAdmin();
  const totalPages = Math.max(1, Math.ceil(totalTests / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;

  const tests = await listRecentTestsForAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const pageHref = (targetPage) =>
    adminHref('/admin/tests', { viaToken, key }, { page: targetPage > 1 ? targetPage : undefined });

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16 space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin — Tests</h1>

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">Recent tests</h2>
          <table className="data-table mt-2 w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink">
                <th className="py-2">Title</th>
                <th className="py-2 text-right">Resp.</th>
                <th className="py-2">Status</th>
                <th className="py-2">Flags</th>
                <th className="py-2">Links</th>
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
                  <td className="py-2">{test.reported_count > 0 ? `⚠️ ${test.reported_count}` : ''}</td>
                  {/* "results" still opens /r/<token>'s full Manage-this-test
                    * menu (pause/resume, export, delete) — kept for anything
                    * beyond delete. Delete also lives right here now so the
                    * single most common moderation action doesn't need the
                    * extra click through. */}
                  <td className="py-2 space-x-2">
                    <a className="underline" href={`/r/${test.creator_token}`}>
                      results
                    </a>
                    <a className="underline" href={`/t/${test.slug}`}>
                      page
                    </a>
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
          Delete an abusive test directly above, or open its results link to pause, export, or delete it there.
          <a className="ml-2 underline" href={pageHref(page)}>
            refresh
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
