import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { AdminPagination } from '../../../components/AdminPagination.js';
import { formatPrice } from '../../../lib/config.js';
import { listPaymentsForAdmin, countPaymentsForAdmin, getPaymentSummary } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — payments', robots: { index: false, follow: false } };

const PAGE_SIZE = 15;

export default async function AdminPaymentsPage({ searchParams }) {
  const { key, page: pageParam } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  // Count first, clamp the requested page into range, THEN fetch that page's
  // rows — same order as /admin/users and for the same reason: a stale or
  // hand-edited `?page=` can't run past the real last page into an empty table.
  const [totalPayments, paymentSummary] = await Promise.all([countPaymentsForAdmin(), getPaymentSummary()]);
  const totalPages = Math.max(1, Math.ceil(totalPayments / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;

  const payments = await listPaymentsForAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const pageHref = (targetPage) =>
    adminHref('/admin/payments', { viaToken, key }, { page: targetPage > 1 ? targetPage : undefined });

  const knownEarningsCount = paymentSummary.earningsTotals.reduce((sum, t) => sum + t.known_count, 0);

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16 space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin — Payments</h1>

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">
            Payments
            {paymentSummary.mock_count > 0 && (
              <span className="pill ml-2 bg-locked">{paymentSummary.mock_count} dev-mode</span>
            )}
          </h2>
          {/* Totalled per currency, never summed across them: a single figure
            * mixing EUR and USD unlocks is not a number, it is a coincidence. */}
          <p className="hint mt-1">
            {paymentSummary.succeeded_count} succeeded ·{' '}
            {paymentSummary.totals.length
              ? paymentSummary.totals.map((t) => formatPrice(t.total, t.currency)).join(' + ')
              : '—'}{' '}
            gross. <code>provider = &apos;dev_mock&apos;</code> rows are simulated unlocks, not real revenue.
          </p>
          {/* Paddle's own fee/earnings breakdown, summed. The closest honest
            * substitute for "account balance" this app can show — Paddle's
            * Billing API has no balance/payout endpoint at all (checked
            * directly: 404, not a permissions gate), so there is no single
            * authoritative number to fetch. This is a derived total from real
            * transactions, not Paddle's own ledger — it won't reflect
            * refunds/adjustments, which this API key also can't currently
            * read (403 on /adjustments). */}
          <p className="hint mt-1">
            {paymentSummary.earningsTotals.length ? (
              <>
                You keep {paymentSummary.earningsTotals.map((t) => formatPrice(t.total, t.currency)).join(' + ')}{' '}
                after Paddle&apos;s fees, across {knownEarningsCount} real transaction{knownEarningsCount === 1 ? '' : 's'}.
              </>
            ) : (
              'No fee/earnings data yet — populated from Paddle on each new real transaction.'
            )}
            {paymentSummary.paddle_missing_earnings_count > 0 && (
              <>
                {' '}
                {paymentSummary.paddle_missing_earnings_count} earlier real transaction
                {paymentSummary.paddle_missing_earnings_count === 1 ? '' : 's'} predate this and{' '}
                {paymentSummary.paddle_missing_earnings_count === 1 ? 'is' : 'are'} not counted.
              </>
            )}
          </p>
          <table className="data-table mt-3 w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink">
                <th className="py-2">Test</th>
                <th className="py-2">User</th>
                <th className="py-2">Provider</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Fee</th>
                <th className="py-2 text-right">Net</th>
                <th className="py-2">Status</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td className="py-3 text-muted" colSpan={8}>
                    No payments yet.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
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
                  <td className="py-2 text-right tabular-nums text-muted">
                    {p.fee != null ? formatPrice(p.fee, p.currency) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-bold">
                    {p.earnings != null ? formatPrice(p.earnings, p.currency) : '—'}
                  </td>
                  <td className="py-2">{p.status}</td>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <AdminPagination page={page} totalPages={totalPages} total={totalPayments} pageSize={PAGE_SIZE} buildHref={pageHref} />
        </div>

        <p className="hint">
          Admin is read-only by design.
          <a className="ml-2 underline" href={pageHref(page)}>
            refresh
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
