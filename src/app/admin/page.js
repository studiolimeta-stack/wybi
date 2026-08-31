import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { AdminDenied } from '../../components/AdminDenied.js';
import { config } from '../../lib/config.js';
import { query } from '../../lib/db.js';
import { getTrafficSummary, getActiveVisitors } from '../../lib/umamiAdmin.js';
import { currentUser } from '../../lib/session.js';
import { checkAdminAccess, adminHref } from '../../lib/adminAuth.js';
import OnlineNow from '../../components/OnlineNow.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * Admin used to be one long page — Overview, Users, Payments, Recent tests,
 * all stacked and scrolled past. Split into four pages (this file plus
 * users/, payments/, tests/) once Payments grew a second summary line and
 * Users grew filters — reachable via the "Admin" dropdown in AccountSubNav
 * (see AdminNavDropdown.js) rather than one link.
 *
 * This page keeps only what belongs on a landing screen: the headline
 * numbers, traffic, the funnel, and reported tests — the one thing here that
 * actually needs action, not just reading.
 */
async function loadOverview() {
  const [tests, responses, funnel, reports] = await Promise.all([
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
  ]);

  // Distribution matters more than the average here — a handful of viral tests
  // would otherwise hide the fact that most tests get nothing. The top bucket
  // is the free limit itself, read from config rather than hardcoded.
  const distribution = await query(
    `SELECT
      COUNT(*) FILTER (WHERE n >= 1)::int  AS with_any,
      COUNT(*) FILTER (WHERE n >= 5)::int  AS with_five,
      COUNT(*) FILTER (WHERE n >= $1)::int AS with_free_limit
    FROM (SELECT t.id, COUNT(r.id) AS n FROM tests t LEFT JOIN responses r ON r.test_id = t.id GROUP BY t.id) s`,
    [config.freeResponseLimit],
  );

  const [traffic, onlineNow] = await Promise.all([getTrafficSummary({ days: 30 }), getActiveVisitors()]);

  return {
    tests: tests.rows[0],
    responses: responses.rows[0].total,
    funnel: funnel.rows,
    reports: reports.rows,
    distribution: distribution.rows[0],
    traffic,
    onlineNow,
  };
}

export default async function AdminOverviewPage({ searchParams }) {
  const { key } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  const data = await loadOverview();

  // The online-now poll hits an API route directly (no page reload to carry a
  // session cookie through), so a token-authed visit has to pass its own key
  // explicitly — a session-authed visit sends the cookie automatically.
  const onlineNowQuery = viaToken ? `?key=${encodeURIComponent(key)}` : '';

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

        <p className="hint">
          Admin is read-only by design. Pause or delete an abusive test from its results link above.
          <a className="ml-2 underline" href={adminHref('/admin', { viaToken, key })}>
            refresh
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
