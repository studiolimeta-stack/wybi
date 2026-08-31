import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { AdminDenied } from '../../components/AdminDenied.js';
import { Meter } from '../../components/ResultsBlocks.js';
import { config } from '../../lib/config.js';
import { query } from '../../lib/db.js';
import { getTrafficSummary, getActiveVisitors } from '../../lib/umamiAdmin.js';
import { currentUser } from '../../lib/session.js';
import { checkAdminAccess, adminHref } from '../../lib/adminAuth.js';
import OnlineNow from '../../components/OnlineNow.js';
import { DeleteTestButton } from '../../components/DeleteTestButton.js';

export const dynamic = 'force-dynamic';

/**
 * ok/sun/alert against a named target — same three-tier shape (and the same
 * exact classes) as ResultsBlocks.js's CONFIDENCE_TIERS (>=100% of goal
 * solid, >=50% directional, below that too thin): it's the same judgement,
 * "how far from where we said we wanted to be," not a new scale for admin.
 *
 * `pillClass` puts sun/ok/alert as a FILL with contrast-safe text on top
 * (ink-on-sun, white-on-ok/alert), never as text color directly — the
 * globals.css comment on `--color-sun` is explicit that it's "fill only"
 * (ink on it is 12.4:1; sun itself on paper is not text-safe).
 */
function targetTier(value, target) {
  if (value >= target) return { label: 'On track', fill: 'var(--color-ok)', pillClass: 'bg-ok text-white border-ok' };
  if (value >= target * 0.5) return { label: 'Behind pace', fill: 'var(--color-sun)', pillClass: 'bg-sun text-ink border-sun' };
  return { label: 'Far behind', fill: 'var(--color-alert)', pillClass: 'bg-alert text-white border-alert' };
}

/**
 * The three funnel stages, in funnel order — never sorted by size, since the
 * whole point is that each is a subset of the one above it. `target` is null
 * for the first stage on purpose: there's no named goal for "got a response
 * at all" in the PRD, and a target tick with no target to justify it would be
 * a mark that isn't backed by data.
 *
 * Row 3's target (20 tests) is an absolute headcount, not a % of current
 * total — it's a goal for future growth, and today's total (15) is smaller
 * than it. `meterMax` below is computed per row as
 * max(value, target, total) specifically so that stays legible: once total
 * grows past the target, the bar's scale grows with it and the target tick
 * slides left of the end instead of the story silently going stale.
 */
function distributionStages(distribution, totalTests) {
  return [
    {
      key: 'any',
      label: 'Got at least one response',
      value: distribution.with_any,
      target: null,
      note: `${Math.round((distribution.with_any / (totalTests || 1)) * 100)}% of all tests — the baseline everything below depends on.`,
    },
    {
      key: 'five',
      label: 'Reached 5+ responses',
      value: distribution.with_five,
      target: Math.round(totalTests * 0.5),
      targetNote: '50% of tests',
    },
    {
      key: 'limit',
      label: `Reached the free limit (${config.freeResponseLimit})`,
      value: distribution.with_free_limit,
      target: 20,
      targetNote: '20 tests',
    },
  ];
}
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
          <p className="hint mt-1">
            Each stage is a subset of the one above — how many tests ever leave the free tier behind.
          </p>

          <div className="mt-4 space-y-4">
            {distributionStages(data.distribution, data.tests.total).map((stage) => {
              const tier = stage.target != null ? targetTier(stage.value, stage.target) : null;
              const color = tier?.fill ?? 'var(--color-accent)';
              const meterMax = Math.max(stage.value, stage.target ?? 0, data.tests.total, 1);

              return (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <p>{stage.label}</p>
                    <p className="shrink-0 flex items-baseline gap-2 tabular-nums">
                      <strong className="text-lg">{stage.value}</strong>
                      {tier && <span className={`pill ${tier.pillClass}`}>{tier.label}</span>}
                    </p>
                  </div>
                  <div className="mt-1.5">
                    <Meter value={stage.value} max={meterMax} color={color} target={stage.target} thick />
                  </div>
                  <p className="hint mt-1">{stage.target != null ? `Target: ${stage.targetNote}` : stage.note}</p>
                </div>
              );
            })}
          </div>
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
                  <span className="ml-2">
                    <DeleteTestButton token={report.creator_token} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="hint">
          Delete a reported test directly above, or open its results link to pause, export, or delete it there.
          <a className="ml-2 underline" href={adminHref('/admin', { viaToken, key })}>
            refresh
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
