import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { config, formatPrice } from '../../lib/config.js';
import { query } from '../../lib/db.js';
import {
  listUsersForAdmin,
  getUserSummary,
  listPaymentsForAdmin,
  getPaymentSummary,
  isAdminEmail,
  isValidAdminToken,
} from '../../lib/admin.js';
import { getTrafficSummary, getActiveVisitors } from '../../lib/umamiAdmin.js';
import { currentUser } from '../../lib/session.js';
import OnlineNow from '../../components/OnlineNow.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * Two ways in, on purpose: a logged-in session for a person, a token for
 * scripts. The token still works — nothing that used the old ?key= link
 * breaks — but it's no longer the only door. A secret sitting in a URL is one
 * careless paste from leaking; a session is bound to a signed-in browser.
 * Shared with lib/admin.js so the online-now API route checks the identical
 * rule instead of a second copy that could drift.
 */
const isTokenValid = isValidAdminToken;

async function loadOverview(userFilter) {
  const [tests, responses, funnel, reports, recent] = await Promise.all([
    query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE is_paid)::int AS paid
      FROM tests`),
    query('SELECT COUNT(*)::int AS total FROM responses'),
    query(`
      SELECT name, COUNT(*)::int AS n
      FROM events
      WHERE created_at > now() - interval '30 days'
      GROUP BY name ORDER BY n DESC`),
    query(`
      SELECT tr.id, tr.reason, tr.created_at, t.slug, t.title, t.creator_token
      FROM test_reports tr JOIN tests t ON t.id = tr.test_id
      ORDER BY tr.created_at DESC LIMIT 25`),
    query(`
      SELECT t.id, t.slug, t.title, t.status, t.is_paid, t.created_at, t.reported_count,
             (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count
      FROM tests t ORDER BY t.created_at DESC LIMIT 40`),
  ]);

  // Distribution matters more than the average here — a handful of viral tests
  // would otherwise hide the fact that most tests get nothing.
  // The top bucket is the free limit itself, read from config rather than
  // hardcoded — it used to be a literal 25 that stayed behind when the free
  // tier moved, which is the same drift the copy had.
  const distribution = await query(
    `SELECT
      COUNT(*) FILTER (WHERE n >= 1)::int  AS with_any,
      COUNT(*) FILTER (WHERE n >= 5)::int  AS with_five,
      COUNT(*) FILTER (WHERE n >= $1)::int AS with_free_limit
    FROM (SELECT t.id, COUNT(r.id) AS n FROM tests t LEFT JOIN responses r ON r.test_id = t.id GROUP BY t.id) s`,
    [config.freeResponseLimit],
  );

  const [users, userSummary, payments, paymentSummary, traffic, onlineNow] = await Promise.all([
    listUsersForAdmin({ limit: 100, filter: userFilter }),
    getUserSummary(),
    listPaymentsForAdmin({ limit: 100 }),
    getPaymentSummary(),
    getTrafficSummary({ days: 30 }),
    getActiveVisitors(),
  ]);

  return {
    tests: tests.rows[0],
    responses: responses.rows[0].total,
    funnel: funnel.rows,
    reports: reports.rows,
    recent: recent.rows,
    distribution: distribution.rows[0],
    users,
    userSummary,
    payments,
    paymentSummary,
    traffic,
    onlineNow,
  };
}

const USER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'free', label: 'Free' },
];

export default async function AdminPage({ searchParams }) {
  const { key, users: userFilterParam } = await searchParams;
  const viaToken = isTokenValid(key);
  const user = await currentUser();

  if (!viaToken && !isAdminEmail(user?.email)) {
    return (
      <>
        <SiteHeader />
        <main className="wrap pt-6 pb-16">
          <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
          {user ? (
            <p className="mt-2 text-muted">
              Signed in as <strong>{user.email}</strong>, but that account isn&apos;t on the admin list.
            </p>
          ) : (
            <>
              <p className="mt-2 text-muted">Log in with an admin account to see this page.</p>
              <Link href="/login?next=/admin" className="btn btn-primary mt-4 inline-block">
                Log in
              </Link>
            </>
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  const userFilter = USER_FILTERS.some((f) => f.value === userFilterParam) ? userFilterParam : 'all';
  const data = await loadOverview(userFilter);

  // Only carries the token through when that's how we got in — a session
  // doesn't need one, and re-appending a stale/absent key would break the
  // next click for a session-authed visit.
  const adminHref = (extra = {}) => {
    const params = new URLSearchParams();
    if (viaToken) params.set('key', key);
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/admin${qs ? `?${qs}` : ''}`;
  };

  // The online-now poll hits an API route directly (no page reload to carry
  // a session cookie through), so a token-authed visit has to pass its own
  // key explicitly — a session-authed visit sends the cookie automatically.
  const onlineNowQuery = viaToken ? `?key=${encodeURIComponent(key)}` : '';

  // Same token-passthrough rule as adminHref — /admin/users/[id] is a
  // separate page, not a query param on this one, so it needs its own key.
  const userHref = (id) => `/admin/users/${id}${viaToken ? `?key=${encodeURIComponent(key)}` : ''}`;

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16 space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Tests', value: data.tests.total },
          { label: 'Active', value: data.tests.active },
          { label: 'Paid', value: data.tests.paid },
          { label: 'Responses', value: data.responses },
        ].map((tile) => (
          <div key={tile.label} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
            <p className="text-2xl font-extrabold">{tile.value}</p>
          </div>
        ))}
      </div>

      {data.traffic && (
        <div className="grid gap-3 sm:grid-cols-4">
          <OnlineNow initialVisitors={data.onlineNow} tokenQuery={onlineNowQuery} />
          {[
            { label: 'Visitors (30d)', value: data.traffic.visitors },
            { label: 'Pageviews (30d)', value: data.traffic.pageviews },
            { label: 'Visits (30d)', value: data.traffic.visits },
          ].map((tile) => (
            <div key={tile.label} className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
              <p className="text-2xl font-extrabold">{tile.value}</p>
            </div>
          ))}
          <p className="hint sm:col-span-4">
            Live from Umami.{' '}
            <a
              className="underline"
              href={`https://mario-umami.crhq.ai/websites/${config.analytics.websiteId}`}
              target="_blank"
              rel="noreferrer"
            >
              Full analytics
            </a>
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-extrabold">Distribution — the number that decides V1</h2>
        <ul className="mt-2 text-sm space-y-1">
          <li>Tests with ≥1 response: <strong>{data.distribution.with_any}</strong> / {data.tests.total}</li>
          <li>Tests with ≥5 responses: <strong>{data.distribution.with_five}</strong> (target: 50% of tests)</li>
          <li>
            Tests with {config.freeResponseLimit} responses (the free limit):{' '}
            <strong>{data.distribution.with_free_limit}</strong> (target: 20 tests)
          </li>
        </ul>
      </div>

      <div className="card p-5">
        <h2 className="font-extrabold">Events — last 30 days</h2>
        <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {data.funnel.length === 0 && <p className="text-muted">No events yet.</p>}
          {data.funnel.map((row) => (
            <div key={row.name} className="flex justify-between border-b border-line py-1">
              <span className="font-mono text-xs">{row.name}</span>
              <strong className="tabular-nums">{row.n}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: 'Users', value: data.userSummary.total },
          { label: 'Paid', value: data.userSummary.paid },
          { label: 'Free', value: data.userSummary.total - data.userSummary.paid },
          { label: 'Verified', value: data.userSummary.verified },
          { label: 'Active (30d)', value: data.userSummary.active_30d },
        ].map((tile) => (
          <div key={tile.label} className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
            <p className="text-2xl font-extrabold">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-extrabold">Users</h2>
          <div className="flex gap-1 rounded-full border-2 border-ink bg-white p-1">
            {USER_FILTERS.map((f) => (
              <a
                key={f.value}
                href={adminHref({ users: f.value === 'all' ? undefined : f.value })}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  userFilter === f.value ? 'bg-ink text-white' : 'text-muted'
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>
        </div>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left border-b-2 border-ink">
              <th className="py-2">Status</th>
              <th className="py-2">Name / Email</th>
              <th className="py-2">Sign-in</th>
              <th className="py-2 text-right">Tests</th>
              <th className="py-2 text-right">Responses</th>
              <th className="py-2 text-right">Spent</th>
              <th className="py-2">Joined</th>
              <th className="py-2">Last login</th>
            </tr>
          </thead>
          <tbody>
            {data.users.length === 0 && (
              <tr>
                <td className="py-3 text-muted" colSpan={8}>
                  No accounts match this filter.
                </td>
              </tr>
            )}
            {data.users.map((u) => (
              <tr key={u.id} className="border-b border-line">
                <td className="py-2">
                  <span className={`pill ${u.paid_test_count > 0 ? 'bg-white text-ok border-ok' : 'bg-locked'}`}>
                    {u.paid_test_count > 0 ? 'Paid' : 'Free'}
                  </span>
                </td>
                <td className="py-2">
                  <a href={userHref(u.id)} className="font-semibold underline">
                    {u.name || u.email}
                  </a>
                  <p className="hint">
                    {u.email}
                    {!u.email_verified_at && ' ⚠️ unverified'}
                  </p>
                </td>
                <td className="py-2">{(u.providers || []).join(', ') || '—'}</td>
                <td className="py-2 text-right tabular-nums">{u.test_count}</td>
                <td className="py-2 text-right tabular-nums">{u.response_count}</td>
                <td className="py-2 text-right tabular-nums">
                  {u.total_paid > 0 ? formatPrice(u.total_paid, u.paid_currency) : '—'}
                </td>
                <td className="py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint mt-2">⚠️ unverified = email captured at test creation but never confirmed by a real login.</p>
      </div>

      <div className="card p-5 overflow-x-auto">
        <h2 className="font-extrabold">
          Payments
          {data.paymentSummary.mock_count > 0 && (
            <span className="pill ml-2 bg-locked">{data.paymentSummary.mock_count} dev-mode</span>
          )}
        </h2>
        {/* Totalled per currency, never summed across them: a single figure
          * mixing EUR and USD unlocks is not a number, it is a coincidence. */}
        <p className="hint mt-1">
          {data.paymentSummary.succeeded_count} succeeded ·{' '}
          {data.paymentSummary.totals.length
            ? data.paymentSummary.totals.map((t) => formatPrice(t.total, t.currency)).join(' + ')
            : '—'}{' '}
          total. <code>provider = &apos;dev_mock&apos;</code> rows are simulated unlocks, not real revenue.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left border-b-2 border-ink">
              <th className="py-2">Test</th>
              <th className="py-2">User</th>
              <th className="py-2">Provider</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2">Status</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.length === 0 && (
              <tr>
                <td className="py-3 text-muted" colSpan={6}>
                  No payments yet.
                </td>
              </tr>
            )}
            {data.payments.map((p) => (
              <tr key={p.id} className="border-b border-line">
                <td className="py-2">
                  {p.test_slug ? (
                    <a className="underline" href={`/r/${p.creator_token}`}>
                      {p.test_title}
                    </a>
                  ) : (
                    p.test_title || '—'
                  )}
                </td>
                <td className="py-2">{p.user_email || '—'}</td>
                <td className="py-2">
                  <span className={`pill ${p.provider === 'dev_mock' ? 'bg-locked' : 'bg-white'}`}>
                    {p.provider}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{formatPrice(p.amount, p.currency)}</td>
                <td className="py-2">{p.status}</td>
                <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.reports.length > 0 && (
        <div className="card p-5">
          <h2 className="font-extrabold text-alert">Reported tests</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.reports.map((report) => (
              <li key={report.id} className="border-b border-line pb-2">
                <strong>{report.title}</strong> — {report.reason}
                <a className="ml-2 underline" href={`/r/${report.creator_token}`}>
                  results
                </a>
                <a className="ml-2 underline" href={`/t/${report.slug}`}>
                  page
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5 overflow-x-auto">
        <h2 className="font-extrabold">Recent tests</h2>
        <table className="mt-2 w-full text-sm">
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
            {data.recent.map((test) => (
              <tr key={test.id} className="border-b border-line">
                <td className="py-2">{test.title}</td>
                <td className="py-2 text-right tabular-nums">{test.response_count}</td>
                <td className="py-2">{test.status}</td>
                <td className="py-2">{test.reported_count > 0 ? `⚠️ ${test.reported_count}` : ''}</td>
                <td className="py-2">
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
        <a className="ml-2 underline" href={adminHref()}>
          refresh
        </a>
      </p>
      </main>
      <SiteFooter />
    </>
  );
}
