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
  const shown = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return `${currencySymbol(currency)}${shown}${BILLING_SUFFIX[billingType] ?? ''}`;
}
