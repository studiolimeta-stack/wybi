import Link from 'next/link';
import { AdminShell } from '../../../../components/AdminShell.js';
import { AdminDenied } from '../../../../components/AdminDenied.js';
import { AdminSortHeader } from '../../../../components/AdminSortHeader.js';
import { formatPrice } from '../../../../lib/config.js';
import { getUserForAdmin, listTestsForUserAdmin } from '../../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../../lib/adminAuth.js';
import { currentUser } from '../../../../lib/session.js';
import { BanUserButton } from './BanUserButton.js';
import { DeleteTestButton } from '../../../../components/DeleteTestButton.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — user', robots: { index: false, follow: false } };
const USER_TEST_SORT_KEYS = new Set(['title', 'status', 'responses', 'prices', 'created']);

/**
 * Account detail behind the user row on /admin. Deliberately does NOT
 * impersonate the account (no session swap, no "log in as") — it links out
 * to `/r/[creator_token]`, the same results page the creator themselves
 * uses, which needs only the token, not their session. That's the real
 * "what they see," with no new auth surface to get wrong.
 *
 * Two mutations happen directly from this page: delete (DeleteTestButton,
 * shared with /admin/tests — reuses the creator's own DELETE route, see that
 * component's docstring) and ban (BanUserButton — the one action with no
 * existing creator-facing surface to reuse, so it gets a real admin-only
 * mutation route instead).
 */
export default async function AdminUserPage({ params, searchParams }) {
  const { id } = await params;
  const { key, sort: sortParam, dir: dirParam } = await searchParams;
  const adminUser = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user: adminUser });

  if (!authorized) return <AdminDenied user={adminUser} />;

  const sort = USER_TEST_SORT_KEYS.has(sortParam) ? sortParam : 'created';
  const direction = dirParam === 'asc' ? 'asc' : 'desc';

  const backHref = viaToken ? `/admin/users?key=${encodeURIComponent(key)}` : '/admin/users';
  const target = await getUserForAdmin(id);

  if (!target) {
    return (
      <AdminShell>
          <Link href={backHref} className="hint underline">
            ← Back to users
          </Link>
          <p className="mt-4 text-muted">No user with id {id}.</p>
      </AdminShell>
    );
  }

  const tests = await listTestsForUserAdmin(id, { sort, direction });
  const sortHref = (nextSort) =>
    adminHref(`/admin/users/${id}`, { viaToken, key }, {
      sort: nextSort,
      dir: sort === nextSort && direction === 'asc' ? 'desc' : 'asc',
    });

  return (
    <AdminShell mainClassName="wrap pt-6 pb-16 space-y-6">
        <Link href={backHref} className="hint underline">
          ← Back to users
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {target.name || target.email}
              {target.banned_at && <span className="pill ml-2 border-alert bg-white text-alert">Banned</span>}
            </h1>
            <p className="hint mt-1">
              {target.email}
              {!target.email_verified_at && ' ⚠️ unverified'} ·{' '}
              {(target.providers || []).join(', ') || 'email login'} · joined{' '}
              {new Date(target.created_at).toLocaleDateString()}
              {target.last_login_at && ` · last login ${new Date(target.last_login_at).toLocaleDateString()}`}
              {target.total_paid > 0 && ` · ${formatPrice(target.total_paid, target.paid_currency)} spent`}
              {target.banned_at && ` · banned ${new Date(target.banned_at).toLocaleDateString()}`}
            </p>
          </div>
          <BanUserButton userId={target.id} banned={Boolean(target.banned_at)} adminKey={viaToken ? key : null} />
        </div>

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">Tests ({tests.length})</h2>
          {tests.length === 0 ? (
            <p className="hint mt-2">This account hasn&apos;t created any tests.</p>
          ) : (
            <table className="data-table mt-3 w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-ink">
                  <AdminSortHeader active={sort === 'title'} direction={direction} href={sortHref('title')}>Title</AdminSortHeader>
                  <AdminSortHeader active={sort === 'status'} direction={direction} href={sortHref('status')}>Status</AdminSortHeader>
                  <AdminSortHeader className="text-right" active={sort === 'responses'} direction={direction} href={sortHref('responses')}>Resp.</AdminSortHeader>
                  <AdminSortHeader className="text-right" active={sort === 'prices'} direction={direction} href={sortHref('prices')}>Prices</AdminSortHeader>
                  <AdminSortHeader active={sort === 'created'} direction={direction} href={sortHref('created')}>Created</AdminSortHeader>
                  <th className="py-2">Links</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-b border-line">
                    <td className="py-2">{t.title}</td>
                    <td className="py-2">
                      <span className={`pill ${t.is_paid ? 'bg-white text-ok border-ok' : 'bg-locked'}`}>
                        {t.status}
                        {t.is_paid ? ' · paid' : ''}
                      </span>
                      {t.reported_count > 0 && <span className="ml-1 text-alert">⚠️ {t.reported_count}</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{t.response_count}</td>
                    <td className="py-2 text-right tabular-nums">{t.variant_count}</td>
                    <td className="py-2">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-2 space-x-2">
                      <a className="underline" href={`/r/${t.creator_token}`} target="_blank" rel="noreferrer">
                        results (as them)
                      </a>
                      <a className="underline" href={`/t/${t.slug}`} target="_blank" rel="noreferrer">
                        page
                      </a>
                    </td>
                    <td className="py-2">
                      <DeleteTestButton token={t.creator_token} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="hint">
          &quot;results (as them)&quot; opens the exact page this creator sees — same URL they'd bookmark, no
          impersonation needed. Delete a test directly above, or open its results link to pause or export it.
        </p>
    </AdminShell>
  );
}
