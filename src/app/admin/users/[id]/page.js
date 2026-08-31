import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../../../components/SiteChrome.js';
import { AdminDenied } from '../../../../components/AdminDenied.js';
import { formatPrice } from '../../../../lib/config.js';
import { getUserForAdmin, listTestsForUserAdmin } from '../../../../lib/admin.js';
import { checkAdminAccess } from '../../../../lib/adminAuth.js';
import { currentUser } from '../../../../lib/session.js';
import { BanUserButton } from './BanUserButton.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — user', robots: { index: false, follow: false } };

/**
 * Account detail behind the user row on /admin. Deliberately does NOT
 * impersonate the account (no session swap, no "log in as") — it links out
 * to `/r/[creator_token]`, the same results page the creator themselves
 * uses, which needs only the token, not their session. That's the real
 * "what they see," with no new auth surface to get wrong.
 *
 * The one exception to "admin is read-only" (see /admin/tests) is the ban
 * control below — banning has no existing creator-facing surface to reuse
 * the way test moderation does, so it gets a real admin-only mutation.
 */
export default async function AdminUserPage({ params, searchParams }) {
  const { id } = await params;
  const { key } = await searchParams;
  const adminUser = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user: adminUser });

  if (!authorized) return <AdminDenied user={adminUser} />;

  const backHref = viaToken ? `/admin/users?key=${encodeURIComponent(key)}` : '/admin/users';
  const target = await getUserForAdmin(id);

  if (!target) {
    return (
      <>
        <SiteHeader />
        <main className="wrap pt-6 pb-16">
          <Link href={backHref} className="hint underline">
            ← Back to users
          </Link>
          <p className="mt-4 text-muted">No user with id {id}.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const tests = await listTestsForUserAdmin(id);

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16 space-y-6">
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
                  <th className="py-2">Title</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Resp.</th>
                  <th className="py-2 text-right">Prices</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Links</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="hint">
          &quot;results (as them)&quot; opens the exact page this creator sees — same URL they'd bookmark, no
          impersonation needed. Test moderation (pause/delete) happens from that page, not here. Banning is the
          one action available directly on this screen.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
