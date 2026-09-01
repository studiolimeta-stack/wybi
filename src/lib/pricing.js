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
