import { timingSafeEqual } from 'node:crypto';
import { query } from './db.js';
import { config } from './config.js';
import { summarisePaymentsEur } from './pricing.js';
import { ratesToEur } from './fx.js';

/**
 * Admin-only read queries. Kept separate from lib/tests.js and lib/auth.js
 * because these deliberately join across users/tests/payments in ways no
 * normal request path should — a bug here should be easy to spot as
 * admin-surface-only, not buried in the creator-facing data layer.
 */

/**
 * The one place that decides whether an email is an admin. Used by both the
 * /admin page (to authorise) and the header (to decide whether to show the
 * Admin link at all) — defined once so those two can never drift apart.
 */
export function isAdminEmail(email) {
  return Boolean(email && config.adminEmails.includes(email.toLowerCase()));
}

/**
 * The `?key=` door into /admin, shared with anything that needs the same
 * scripted/API access (e.g. the online-now polling route) — defined once so
 * the admin page and its API routes can't drift apart on what counts as a
 * valid token.
 */
export function isValidAdminToken(key) {
  if (typeof key !== 'string') return false;
  const provided = Buffer.from(key);
  const expected = Buffer.from(config.adminToken);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * Shared by `listUsersForAdmin` and `countUsersForAdmin` — one place for the
 * filter logic so the list and its count can never drift onto different
 * WHERE clauses (which would show e.g. "Page 1 of 3" against a table that
 * only ever has 1 page of rows, or vice versa).
 */
function userFilterWhere(filter) {
  return filter === 'paid' ? "WHERE EXISTS (SELECT 1 FROM tests t WHERE t.user_id = u.id AND t.is_paid)"
    : filter === 'free' ? "WHERE NOT EXISTS (SELECT 1 FROM tests t WHERE t.user_id = u.id AND t.is_paid)"
    : '';
}

/** `sort` only ever selects an entry from one of the maps below — never raw SQL from a URL. */
function orderBy(sortMap, sort, direction, fallback, tieBreak) {
  const column = sortMap[sort] || sortMap[fallback];
  const order = direction === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${order} NULLS LAST, ${tieBreak} DESC`;
}

/**
 * `filter`: 'all' | 'paid' | 'free'. Filtering happens in SQL rather than by
 * slicing the array in the page component — a `LIMIT`/`OFFSET` applied after
 * an in-memory filter would silently under-count and mispaginate.
 */
export async function listUsersForAdmin({ limit = 100, offset = 0, filter = 'all', sort = 'joined', direction = 'desc' } = {}) {
  const ordering = orderBy({
    access: 'paid_test_count',
    name: 'COALESCE(u.name, u.email)',
    provider: 'providers',
    tests: 'test_count',
    responses: 'response_count',
    spent: 'total_paid',
    joined: 'u.created_at',
    login: 'u.last_login_at',
  }, sort, direction, 'joined', 'u.id');
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.email_verified_at, u.created_at, u.last_login_at, u.banned_at,
            (SELECT COUNT(*)::int FROM tests t WHERE t.user_id = u.id AND t.status <> 'archived')
              AS test_count,
            (SELECT COUNT(*)::int FROM tests t WHERE t.user_id = u.id AND t.is_paid)
              AS paid_test_count,
            (SELECT COUNT(*)::int FROM responses r JOIN tests t ON t.id = r.test_id WHERE t.user_id = u.id)
              AS response_count,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded')
              AS total_paid,
            -- The currency actually charged, rather than assuming USD. Unlocks
            -- are priced in the test's own currency, so a EUR creator's total
            -- was previously rendered with a dollar sign.
            (SELECT p.currency FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded'
              ORDER BY p.created_at DESC LIMIT 1)
              AS paid_currency,
            (SELECT array_agg(DISTINCT i.provider ORDER BY i.provider) FROM identities i WHERE i.user_id = u.id)
              AS providers
     FROM users u
     ${userFilterWhere(filter)}
     ${ordering}
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

/** Total row count for a given filter — the denominator `/admin/users` needs to render "Page X of Y". */
export async function countUsersForAdmin({ filter = 'all' } = {}) {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM users u ${userFilterWhere(filter)}`);
  return rows[0].total;
}

/** Single-user lookup for the /admin/users/[id] detail page. Null if the id doesn't exist. */
export async function getUserForAdmin(id) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.email_verified_at, u.created_at, u.last_login_at, u.banned_at,
            (SELECT array_agg(DISTINCT i.provider ORDER BY i.provider) FROM identities i WHERE i.user_id = u.id)
              AS providers,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded')
              AS total_paid,
            (SELECT p.currency FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded'
              ORDER BY p.created_at DESC LIMIT 1)
              AS paid_currency
     FROM users u
     WHERE u.id = $1`,
    [id],
  );
  return rows[0] || null;
}

/**
 * All of one user's tests for the admin detail page — including archived
 * ones, unlike lib/tests.js#listTestsByUserId, which is built for the
 * creator's own /dashboard and deliberately hides those. An admin looking up
 * an account wants the full history, not just what the owner currently sees.
 */
export async function listTestsForUserAdmin(userId, { sort = 'created', direction = 'desc' } = {}) {
  const ordering = orderBy({
    title: 't.title',
    status: 't.status',
    responses: 'response_count',
    prices: 'variant_count',
    created: 't.created_at',
  }, sort, direction, 'created', 't.id');
  const { rows } = await query(
    `SELECT t.id, t.slug, t.title, t.status, t.is_paid, t.currency, t.created_at,
            t.reported_count, t.creator_token,
            (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count,
            (SELECT COUNT(*)::int FROM price_variants pv WHERE pv.test_id = t.id) AS variant_count
     FROM tests t
     WHERE t.user_id = $1
     ${ordering}`,
    [userId],
  );
  return rows;
}

/** The `/admin/tests` table — every test, newest first, with its own response count. */
export async function listRecentTestsForAdmin({ limit = 40, offset = 0, sort = 'created', direction = 'desc' } = {}) {
  const ordering = orderBy({
    title: 't.title',
    responses: 'response_count',
    status: 't.status',
    reports: 't.reported_count',
    created: 't.created_at',
  }, sort, direction, 'created', 't.id');
  const { rows } = await query(
    `SELECT t.id, t.slug, t.title, t.status, t.is_paid, t.created_at, t.reported_count, t.creator_token,
            (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count
     FROM tests t ${ordering} LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

/** Total test count — the denominator `/admin/tests` needs to render "Page X of Y". No filter: same unconditional set listRecentTestsForAdmin lists. */
export async function countTestsForAdmin() {
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM tests');
  return rows[0].total;
}

export async function getUserSummary() {
  const { rows } = await query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS verified,
           COUNT(*) FILTER (WHERE last_login_at > now() - interval '30 days')::int AS active_30d,
           COUNT(*) FILTER (
             WHERE EXISTS (SELECT 1 FROM tests t WHERE t.user_id = u.id AND t.is_paid)
           )::int AS paid
    FROM users u`);
  return rows[0];
}

export async function listPaymentsForAdmin({ limit = 100, offset = 0, sort = 'created', direction = 'desc' } = {}) {
  const ordering = orderBy({
    test: 't.title',
    user: 'u.email',
    provider: 'p.provider',
    amount: 'p.amount',
    fee: 'p.fee',
    net: 'p.earnings',
    status: 'p.status',
    created: 'p.created_at',
  }, sort, direction, 'created', 'p.id');
  const { rows } = await query(
    `SELECT p.id, p.provider, p.provider_payment_id, p.amount, p.currency, p.status, p.created_at,
            p.fee, p.earnings,
            u.email AS user_email,
            t.title AS test_title, t.slug AS test_slug, t.creator_token
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN tests t ON t.id = p.test_id
     ${ordering}
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

/** Total payment count — the denominator `/admin/payments` needs to render "Page X of Y". No filter: same unconditional set listPaymentsForAdmin lists (every status, every provider — including dev_mock/failed, not just succeeded). */
export async function countPaymentsForAdmin() {
  const { rows } = await query('SELECT COUNT(*)::int AS total FROM payments');
  return rows[0].total;
}

/**
 * Revenue is returned broken down by currency, not as one number.
 *
 * `SUM(amount)` across a mixed-currency table produces a figure that looks
 * authoritative and means nothing — $14.90 + ¥14.90 is not 29.80 of anything.
 * The headline count stays global; only the money is split.
 *
 * `earningsTotals` is Paddle's own reported "what you actually keep after
 * their fee", summed the same way — the closest honest substitute for an
 * account balance this app can show, since Paddle's Billing API has no
 * balance/payout endpoint at all (checked directly: 404, not a permissions
 * gate). Only ever sums real Paddle transactions: `fee`/`earnings` are NULL
 * for every `dev_mock` row and for real payments recorded before this column
 * existed, and SUM() over Postgres already ignores NULLs correctly — no
 * COALESCE needed, and none added, so a currency with zero known earnings
 * stays absent from the list rather than rendering a misleading $0.
 */
export async function getPaymentSummary() {
  const [totals, earningsTotals, feeTotals, counts, rateInfo] = await Promise.all([
    query(`
      SELECT currency, COALESCE(SUM(amount), 0) AS total
      FROM payments WHERE status = 'succeeded'
      GROUP BY currency ORDER BY total DESC`),
    query(`
      SELECT currency, SUM(earnings) AS total, COUNT(earnings)::int AS known_count
      FROM payments WHERE status = 'succeeded' AND provider = 'paddle'
      GROUP BY currency HAVING SUM(earnings) IS NOT NULL ORDER BY total DESC`),
    // `gross` here is scoped to the SAME row set as `total` (fee) — real
    // Paddle transactions with a known fee, not every succeeded row. A
    // blended rate divided against the overall gross (which includes
    // zero-fee dev_mock rows) would understate the real rate; this keeps
    // numerator and denominator honest against each other.
    query(`
      SELECT currency, SUM(fee) AS total, SUM(amount) AS gross, COUNT(*)::int AS known_count
      FROM payments WHERE status = 'succeeded' AND provider = 'paddle' AND fee IS NOT NULL
      GROUP BY currency ORDER BY total DESC`),
    query(`
      SELECT COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded_count,
             COUNT(*) FILTER (WHERE provider = 'dev_mock' AND status = 'succeeded')::int AS mock_count,
             COUNT(*) FILTER (WHERE provider = 'paddle' AND status = 'succeeded')::int AS paddle_count,
             COUNT(*) FILTER (WHERE provider = 'paddle' AND status = 'succeeded' AND earnings IS NULL)::int
               AS paddle_missing_earnings_count
      FROM payments`),
    ratesToEur(),
  ]);

  return {
    ...counts.rows[0],
    totals: totals.rows,
    earningsTotals: earningsTotals.rows,
    feeTotals: feeTotals.rows,
    // Single-currency (EUR) rollup for the dashboard tiles — the per-currency
    // arrays above still back the per-row table, which stays in real charged
    // currency. Rates are live ECB daily reference rates (lib/fx.js);
    // `ratesAsOf`/`ratesLive` let the page word the conversion footnote.
    eur: {
      ...summarisePaymentsEur(
        { totals: totals.rows, feeTotals: feeTotals.rows, earningsTotals: earningsTotals.rows },
        rateInfo.rates,
      ),
      ratesAsOf: rateInfo.asOf,
      ratesLive: rateInfo.live,
    },
  };
}
