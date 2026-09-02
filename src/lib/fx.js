import { FX_TO_EUR_FALLBACK } from './pricing.js';

/**
 * Live currency conversion for the internal /admin/payments dashboard.
 *
 * Source: the European Central Bank's daily euro foreign-exchange reference
 * rates (https://www.ecb.europa.eu/stats/eurofxref/) — official, no API key,
 * same URL for ~20 years, published once per TARGET business day around
 * 16:00 CET. We parse the XML directly (no dependency, consistent with the
 * rest of this codebase's hand-rolled-integration style).
 *
 * Cached in-process for 12h, and degrades in tiers without ever throwing:
 *   fresh cache -> live ECB fetch -> stale cache -> static fallback table.
 * These tiles are internal and already labelled approximate — a rates
 * outage must never 500 the page.
 */

const TTL_MS = 12 * 60 * 60 * 1000;
const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const FETCH_TIMEOUT_MS = 4000;

let cache = null; // { rates, asOf, fetchedAt }

/**
 * Parse the ECB eurofxref-daily.xml into a currency->EUR multiplier map.
 * The file lists rates as "units of currency per 1 EUR"; we invert them so
 * `amount * rates[currency]` gives EUR. EUR itself is always 1.
 * Exported for testing.
 */
export function parseEcbXml(xml) {
  const rates = { EUR: 1 };
  const cubeRe = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;
  let match;
  while ((match = cubeRe.exec(xml)) !== null) {
    const perEur = Number(match[2]);
    if (perEur > 0) rates[match[1]] = 1 / perEur;
  }
  const dateMatch = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);
  return { rates, asOf: dateMatch ? dateMatch[1] : null };
}

/**
 * Returns { rates: { EUR: 1, USD: <n>, ... }, asOf: 'YYYY-MM-DD'|null, live: boolean }.
 * `live` is false when the result came from a stale cache or the static
 * fallback — the caller uses it to word the "converted at ..." footnote.
 */
export async function ratesToEur() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return { rates: cache.rates, asOf: cache.asOf, live: true };
  }

  try {
    const res = await fetch(ECB_DAILY_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`ECB responded ${res.status}`);

    const { rates, asOf } = parseEcbXml(await res.text());
    if (!rates.USD) throw new Error('ECB payload missing expected currencies');

    cache = { rates, asOf, fetchedAt: Date.now() };
    return { rates, asOf, live: true };
  } catch (err) {
    console.error('[fx] live ECB rate fetch failed, using fallback:', err?.message || err);
    if (cache) return { rates: cache.rates, asOf: cache.asOf, live: false };
    return { rates: FX_TO_EUR_FALLBACK, asOf: null, live: false };
  }
}
