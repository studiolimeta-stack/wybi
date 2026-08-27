import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../../../components/SiteChrome.js';
import { formatPrice } from '../../../../lib/config.js';
import { isAdminEmail, isValidAdminToken, getUserForAdmin, listTestsForUserAdmin } from '../../../../lib/admin.js';
import { currentUser } from '../../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — user', robots: { index: false, follow: false } };

/**
 * Read-only account detail behind the user row on /admin. Deliberately does
 * NOT impersonate the account (no session swap, no "log in as") — it links
 * out to `/r/[creator_token]`, the same results page the creator themselves
 * uses, which needs only the token, not their session. That's the real
 * "what they see," with no new auth surface to get wrong.
 */
export default async function AdminUserPage({ params, searchParams }) {
  const { id } = await params;
  const { key } = await searchParams;
  const viaToken = isValidAdminToken(key);
  const adminUser = await currentUser();

  if (!viaToken && !isAdminEmail(adminUser?.email)) {
    return (
      <>
        <SiteHeader />
        <main className="wrap pt-6 pb-16">
          <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
          <p className="mt-2 text-muted">Log in with an admin account to see this page.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const backHref = viaToken ? `/admin?key=${encodeURIComponent(key)}` : '/admin';
  const target = await getUserForAdmin(id);

  if (!target) {
    return (
      <>
        <SiteHeader />
        <main className="wrap pt-6 pb-16">
          <Link href={backHref} className="hint underline">
            ← Back to admin
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
          ← Back to admin
        </Link>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{target.name || target.email}</h1>
          <p className="hint mt-1">
            {target.email}
            {!target.email_verified_at && ' ⚠️ unverified'} ·{' '}
            {(target.providers || []).join(', ') || 'email login'} · joined{' '}
            {new Date(target.created_at).toLocaleDateString()}
            {target.last_login_at && ` · last login ${new Date(target.last_login_at).toLocaleDateString()}`}
            {target.total_paid > 0 && ` · ${formatPrice(target.total_paid, target.paid_currency)} spent`}
          </p>
        </div>

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">Tests ({tests.length})</h2>
          {tests.length === 0 ? (
            <p className="hint mt-2">This account hasn&apos;t created any tests.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
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
          impersonation needed. Admin is read-only; nothing here can be changed from this screen.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
