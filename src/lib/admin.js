import { query } from './db.js';
import { config } from './config.js';

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
 * `filter`: 'all' | 'paid' | 'free'. Filtering happens in SQL rather than by
 * slicing the array in the page component — with only 100 rows loaded it
 * wouldn't matter today, but a `LIMIT` applied after an in-memory filter would
 * silently under-count once the user base outgrows that page size.
 */
export async function listUsersForAdmin({ limit = 100, filter = 'all' } = {}) {
  const where = filter === 'paid' ? "WHERE EXISTS (SELECT 1 FROM tests t WHERE t.user_id = u.id AND t.is_paid)"
    : filter === 'free' ? "WHERE NOT EXISTS (SELECT 1 FROM tests t WHERE t.user_id = u.id AND t.is_paid)"
    : '';

  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.email_verified_at, u.created_at, u.last_login_at,
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
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
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

export async function listPaymentsForAdmin({ limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT p.id, p.provider, p.provider_payment_id, p.amount, p.currency, p.status, p.created_at,
            u.email AS user_email,
            t.title AS test_title, t.slug AS test_slug, t.creator_token
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN tests t ON t.id = p.test_id
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Revenue is returned broken down by currency, not as one number.
 *
 * `SUM(amount)` across a mixed-currency table produces a figure that looks
 * authoritative and means nothing — $14.90 + ¥14.90 is not 29.80 of anything.
 * The headline count stays global; only the money is split.
 */
export async function getPaymentSummary() {
  const [totals, counts] = await Promise.all([
    query(`
      SELECT currency, COALESCE(SUM(amount), 0) AS total
      FROM payments WHERE status = 'succeeded'
      GROUP BY currency ORDER BY total DESC`),
    query(`
      SELECT COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded_count,
             COUNT(*) FILTER (WHERE provider = 'dev_mock' AND status = 'succeeded')::int AS mock_count
      FROM payments`),
  ]);

  return { ...counts.rows[0], totals: totals.rows };
}
