import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { listRecentTestsForAdmin } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — tests', robots: { index: false, follow: false } };

export default async function AdminTestsPage({ searchParams }) {
  const { key } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  const tests = await listRecentTestsForAdmin({ limit: 40 });

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
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id} className="border-b border-line">
                  <td className="py-2">{test.title}</td>
                  <td className="py-2 text-right tabular-nums">{test.response_count}</td>
                  <td className="py-2">{test.status}</td>
                  <td className="py-2">{test.reported_count > 0 ? `⚠️ ${test.reported_count}` : ''}</td>
                  {/* "results" is the moderation link, not a nicety: pause and
                    * delete live on /r/<token> (ManageTestMenu), so without it
                    * there'd be no way to act on a test from here at all. */}
                  <td className="py-2 space-x-2">
                    <a className="underline" href={`/r/${test.creator_token}`}>
                      results
                    </a>
                    <a className="underline" href={`/t/${test.slug}`}>
                      page
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="hint">
          Admin is read-only by design. Pause or delete an abusive test from its results link above.
          <a className="ml-2 underline" href={adminHref('/admin/tests', { viaToken, key })}>
            refresh
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
