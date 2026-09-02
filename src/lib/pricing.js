export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const BILLING_SUFFIX = {
  one_time: '',
  per_month: '/month',
  per_year: '/year',
};

export function currencySymbol(code) {
  return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? '$';
}

export function formatPrice(amount, currency, billingType = 'one_time') {
  const value = Number(amount);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const shown = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2);
  return `${sign}${currencySymbol(currency)}${shown}${BILLING_SUFFIX[billingType] ?? ''}`;
}

/**
 * Last-resort currency->EUR multipliers, used only on the internal
 * /admin/payments dashboard when the live ECB rate feed (lib/fx.js) can't be
 * reached and there's no cached value to fall back to.
 *
 * Paddle is Merchant of Record and bills every buyer in their own local
 * currency, so the `payments` table legitimately holds a mix (USD, EUR, …).
 * The per-row Payments table still shows each charge in the real currency the
 * customer was billed; only the summary tiles above it are normalised to EUR
 * so "Gross revenue" / "fees" / "net" are one comparable number instead of
 * "$29.80 + €12.87". Under normal operation these numbers come from lib/fx.js
 * (ECB daily reference rates); this table is just a floor so the page never
 * breaks. Nudge it toward reality if you ever notice it being used.
 */
export const FX_TO_EUR_FALLBACK = { EUR: 1, USD: 0.92, GBP: 1.17 };

/**
 * Convert an amount to EUR using the given currency->EUR rate map (defaults
 * to the static fallback). Returns null if the map has no rate for that
 * currency, so the caller can leave that money out rather than miscount it.
 */
export function toEur(amount, currency, rates = FX_TO_EUR_FALLBACK) {
  const rate = rates[currency];
  if (rate == null) return null;
  return Number(amount) * rate;
}

/**
 * Collapse getPaymentSummary's per-currency rows into a single EUR view for
 * the admin dashboard tiles. Pure — takes the grouped rows plus a
 * currency->EUR rate map, returns numbers. A currency missing from the rate
 * map is skipped (its money is left out of the total rather than counted at
 * the wrong value); `hasUnknownRate` flags it.
 */
export function summarisePaymentsEur({ totals = [], feeTotals = [], earningsTotals = [] } = {}, rates = FX_TO_EUR_FALLBACK) {
  const sum = (rows, field) => rows.reduce((acc, r) => acc + (toEur(r[field], r.currency, rates) ?? 0), 0);
  const currencies = new Set([...totals, ...feeTotals, ...earningsTotals].map((r) => r.currency));
  return {
    gross: sum(totals, 'total'),
    fee: sum(feeTotals, 'total'),
    feeGross: sum(feeTotals, 'gross'),
    earnings: sum(earningsTotals, 'total'),
    grossKnown: totals.length > 0,
    feeKnown: feeTotals.length > 0,
    earningsKnown: earningsTotals.length > 0,
    // Every contributing row is already in EUR — the tiles are exact, drop the "≈".
    exact: currencies.size > 0 && [...currencies].every((c) => c === 'EUR'),
    hasUnknownRate: [...currencies].some((c) => rates[c] == null),
  };
}
