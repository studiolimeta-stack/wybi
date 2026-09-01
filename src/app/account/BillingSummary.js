import Link from 'next/link';
import { isReportLocked } from '../../lib/tests.js';
import { formatPrice } from '../../lib/config.js';
import { PaidPill } from '../../components/StatusPill.js';

/**
 * Unlocks are per TEST here, not an account-wide subscription — there is no
 * single "paid plan" to flip on. So "is this a paid user" is answered
 * honestly as "has this account ever paid," and backed by the real per-test
 * breakdown underneath rather than a single made-up badge, in the same spirit
 * as the results-page paywall never promising a number it hasn't computed.
 */
export function BillingSummary({ tests, payments }) {
  const hasPaid = payments.length > 0;
  const unlockedCount = tests.filter((t) => t.is_paid).length;
  const lockedTests = tests.filter((t) => !t.is_paid && isReportLocked(t, t.response_count));
  const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const nextToUnlock = lockedTests[0] ?? null;

  return (
    <div className="card mt-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">Billing</h2>
        <PaidPill isPaid={hasPaid} />
      </div>

      {hasPaid ? (
        <>
          <p className="hint mt-1">
            {unlockedCount} {unlockedCount === 1 ? 'report' : 'reports'} unlocked · {formatPrice(totalSpent, payments[0].currency)}{' '}
            spent in total.
          </p>

          <ul className="mt-4 divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/r/${p.creator_token}`} className="block truncate font-semibold underline">
                    {p.test_title}
                  </Link>
                  <p className="hint">
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.provider === 'dev_mock' && ' · simulated, not a real charge'}
                    {p.provider === 'paddle' && (
                      <>
                        {' · '}
                        <a href={`/api/account/receipt/${p.id}`} className="underline" target="_blank" rel="noopener">
                          Receipt
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 font-bold tabular-nums">{formatPrice(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>

          {nextToUnlock && (
            <div className="mt-4 rounded-xl border-1.5 border-dashed border-line p-3">
              <p className="hint">
                <strong className="text-ink">{nextToUnlock.title}</strong> has passed the free limit too.
              </p>
              <Link href={`/r/${nextToUnlock.creator_token}`} className="btn btn-plain btn-wrap mt-2 w-full text-sm">
                Unlock full report — $14.90
              </Link>
            </div>
          )}
        </>
      ) : nextToUnlock ? (
        <>
          <p className="hint mt-1">
            <strong className="text-ink">{nextToUnlock.title}</strong> collected {nextToUnlock.response_count}{' '}
            responses — past the free limit. Unlock your full pricing report to get:
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>✓ Purchase intent at every price</li>
            <li>✓ Modelled revenue per price</li>
            <li>✓ Strong purchase-intent breakdown</li>
            <li>✓ CSV export</li>
          </ul>
          <Link href={`/r/${nextToUnlock.creator_token}`} className="btn btn-primary btn-wrap mt-4 w-full">
            Unlock full report — $14.90
          </Link>
          <p className="hint mt-2">Unlocks are per test, not a subscription — you only pay for reports you open.</p>
        </>
      ) : tests.length > 0 ? (
        <p className="hint mt-1">
          Nothing to unlock yet — every test is still within its free response limit. The unlock option
          appears on a test's results page once it passes that.
        </p>
      ) : (
        <>
          <p className="hint mt-1">
            You haven&apos;t created a test yet. Create and collect responses for free. Pay $14.90 only when you
            want to unlock the full pricing report.
          </p>
          <Link href="/create" className="btn btn-primary mt-4 w-full">
            Create a price test
          </Link>
        </>
      )}
    </div>
  );
}
