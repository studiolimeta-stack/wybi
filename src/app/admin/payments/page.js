import { AdminShell } from '../../../components/AdminShell.js';
import { AdminDenied } from '../../../components/AdminDenied.js';
import { AdminPagination } from '../../../components/AdminPagination.js';
import { AdminSortHeader } from '../../../components/AdminSortHeader.js';
import { formatPrice } from '../../../lib/config.js';
import { listPaymentsForAdmin, countPaymentsForAdmin, getPaymentSummary } from '../../../lib/admin.js';
import { checkAdminAccess, adminHref } from '../../../lib/adminAuth.js';
import { currentUser } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — payments', robots: { index: false, follow: false } };

const PAGE_SIZE = 15;
const PAYMENT_SORT_KEYS = new Set(['test', 'user', 'provider', 'amount', 'fee', 'net', 'status', 'created']);

export default async function AdminPaymentsPage({ searchParams }) {
  const { key, page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const user = await currentUser();
  const { authorized, viaToken } = checkAdminAccess({ key, user });

  if (!authorized) return <AdminDenied user={user} />;

  const sort = PAYMENT_SORT_KEYS.has(sortParam) ? sortParam : 'created';
  const direction = dirParam === 'asc' ? 'asc' : 'desc';

  // Count first, clamp the requested page into range, THEN fetch that page's
  // rows — same order as /admin/users and for the same reason: a stale or
  // hand-edited `?page=` can't run past the real last page into an empty table.
  const [totalPayments, paymentSummary] = await Promise.all([countPaymentsForAdmin(), getPaymentSummary()]);
  const totalPages = Math.max(1, Math.ceil(totalPayments / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;

  const payments = await listPaymentsForAdmin({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, sort, direction });

  const pageHref = (targetPage) =>
    adminHref('/admin/payments', { viaToken, key }, { sort, dir: direction, page: targetPage > 1 ? targetPage : undefined });
  const sortHref = (nextSort) =>
    adminHref('/admin/payments', { viaToken, key }, {
      sort: nextSort,
      dir: sort === nextSort && direction === 'asc' ? 'desc' : 'asc',
    });

  // Every money stat is broken down by currency, never summed across them —
  // same discipline as the table itself: `$14.90 + €14.90` joined as text is
  // honest, a single figure adding them together is not.
  const grossText = paymentSummary.totals.length
    ? paymentSummary.totals.map((t) => formatPrice(t.total, t.currency)).join(' + ')
    : '—';
  const feeText = paymentSummary.feeTotals.length
    ? paymentSummary.feeTotals.map((t) => formatPrice(t.total, t.currency)).join(' + ')
    : '—';
  const netText = paymentSummary.earningsTotals.length
    ? paymentSummary.earningsTotals.map((t) => formatPrice(t.total, t.currency)).join(' + ')
    : '—';
  // A ratio, not an amount — safe as one blended figure PER currency (never
  // combining two currencies' fee/gross into one division), computed against
  // the SAME row set feeTotals.total came from, not the overall gross (which
  // would include dev_mock's zero-fee rows and understate the real rate).
  const rateText = paymentSummary.feeTotals.length
    ? paymentSummary.feeTotals.map((t) => `${((Number(t.total) / Number(t.gross)) * 100).toFixed(1)}%`).join(' + ')
    : '—';

  const statTiles = [
    { label: 'Succeeded', value: paymentSummary.succeeded_count },
    { label: 'Real (Paddle)', value: paymentSummary.paddle_count },
    { label: 'Dev-mode (test)', value: paymentSummary.mock_count },
    { label: 'Gross revenue', value: grossText },
    { label: 'Paddle fees', value: feeText },
    { label: 'Net earnings', value: netText },
    { label: 'Blended fee rate', value: rateText },
  ];

  return (
    <AdminShell mainClassName="wrap pt-6 pb-16 space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin — Payments</h1>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
              <p className="text-2xl font-extrabold">{tile.value}</p>
            </div>
          ))}
        </div>
        {/* Paddle's Billing API has no balance/payout endpoint at all (checked
          * directly: 404, not a permissions gate) — "Net earnings" above,
          * derived from real transactions, is the closest honest substitute
          * this app can show, not Paddle's own ledger. It won't reflect
          * refunds/adjustments, which this API key also can't currently read
          * (403 on /adjustments). */}
        {paymentSummary.paddle_missing_earnings_count > 0 && (
          <p className="hint">
            <code>provider = &apos;dev_mock&apos;</code> rows are simulated unlocks, not real revenue —{' '}
            {paymentSummary.paddle_missing_earnings_count} earlier real transaction
            {paymentSummary.paddle_missing_earnings_count === 1 ? '' : 's'} predate fee/earnings tracking and{' '}
            {paymentSummary.paddle_missing_earnings_count === 1 ? 'is' : 'are'} excluded from the stats above.
          </p>
        )}

        <div className="card p-5 overflow-x-auto">
          <h2 className="font-extrabold">Payments</h2>
          <table className="data-table mt-3 w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink">
                <AdminSortHeader active={sort === 'test'} direction={direction} href={sortHref('test')}>Test</AdminSortHeader>
                <AdminSortHeader active={sort === 'user'} direction={direction} href={sortHref('user')}>User</AdminSortHeader>
                <AdminSortHeader active={sort === 'provider'} direction={direction} href={sortHref('provider')}>Provider</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'amount'} direction={direction} href={sortHref('amount')}>Amount</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'fee'} direction={direction} href={sortHref('fee')}>Fee</AdminSortHeader>
                <AdminSortHeader className="text-right" active={sort === 'net'} direction={direction} href={sortHref('net')}>Net</AdminSortHeader>
                <AdminSortHeader active={sort === 'status'} direction={direction} href={sortHref('status')}>Status</AdminSortHeader>
                <AdminSortHeader active={sort === 'created'} direction={direction} href={sortHref('created')}>Date</AdminSortHeader>
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
                    {/* dev_mock vs. a real provider is an environment fact, not
                      * a paid/free status — doesn't wear `bg-locked`. Muted
                      * text is enough to flag "not a real charge" at a glance. */}
                    <span className={`pill bg-white ${p.provider === 'dev_mock' ? 'text-muted border-line' : ''}`}>
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
    </AdminShell>
  );
}
