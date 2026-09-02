#!/usr/bin/env node
/**
 * Unit tests for the admin payments dashboard's single-currency (EUR) rollup
 * and the ECB rate-feed parser. Money shown as one wrong number is worse than
 * money shown as none. All pure — no network, no DB.
 *
 *   node --test scripts/test-payments.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FX_TO_EUR_FALLBACK, toEur, summarisePaymentsEur } from '../src/lib/pricing.js';
import { parseEcbXml } from '../src/lib/fx.js';

const RATES = { EUR: 1, USD: 0.9, GBP: 1.15 };

test('toEur converts with the given rate map and leaves EUR untouched', () => {
  assert.equal(toEur('10', 'EUR', RATES), 10);
  assert.equal(toEur(100, 'USD', RATES), 90);
  assert.ok(Math.abs(toEur(50, 'GBP', RATES) - 57.5) < 1e-9);
});

test('toEur falls back to the static table when no rate map is passed', () => {
  assert.equal(toEur(100, 'USD'), 100 * FX_TO_EUR_FALLBACK.USD);
});

test('toEur returns null for a currency the rate map does not cover', () => {
  assert.equal(toEur(10, 'JPY', RATES), null);
});

test('summarisePaymentsEur collapses a mixed-currency table into one EUR figure', () => {
  const summary = summarisePaymentsEur({
    totals: [
      { currency: 'USD', total: '30' },
      { currency: 'EUR', total: '12.87' },
    ],
    feeTotals: [
      { currency: 'USD', total: '2.50', gross: '30' },
      { currency: 'EUR', total: '1.07', gross: '12.87' },
    ],
    earningsTotals: [
      { currency: 'USD', total: '21', gross: '30' },
      { currency: 'EUR', total: '9.23', gross: '12.87' },
    ],
    taxTotals: [
      { currency: 'USD', total: '6.50', gross: '30' },
      { currency: 'EUR', total: '2.57', gross: '12.87' },
    ],
  }, RATES);

  assert.equal(summary.gross, 30 * 0.9 + 12.87);
  assert.equal(summary.fee, 2.5 * 0.9 + 1.07);
  assert.equal(summary.feeGross, 30 * 0.9 + 12.87);
  assert.equal(summary.earnings, 21 * 0.9 + 9.23);
  assert.equal(summary.earningsGross, 30 * 0.9 + 12.87);
  assert.equal(summary.tax, 6.5 * 0.9 + 2.57);
  assert.equal(summary.taxKnown, true);
  assert.equal(summary.grossKnown, true);
  assert.equal(summary.feeKnown, true);
  assert.equal(summary.earningsKnown, true);
  assert.equal(summary.exact, false);
  assert.equal(summary.hasUnknownRate, false);
});

test('summarisePaymentsEur flags an exact total when every row is already EUR', () => {
  const summary = summarisePaymentsEur({
    totals: [{ currency: 'EUR', total: '12.87' }],
    feeTotals: [{ currency: 'EUR', total: '1.07', gross: '12.87' }],
    earningsTotals: [{ currency: 'EUR', total: '9.23' }],
  }, RATES);
  assert.equal(summary.exact, true);
  assert.equal(summary.gross, 12.87);
});

test('summarisePaymentsEur skips money in an unrated currency and flags it', () => {
  const summary = summarisePaymentsEur({
    totals: [
      { currency: 'EUR', total: '10' },
      { currency: 'JPY', total: '5000' },
    ],
  }, RATES);
  assert.equal(summary.gross, 10); // JPY row left out, not counted at the wrong value
  assert.equal(summary.hasUnknownRate, true);
  assert.equal(summary.exact, false);
});

test('summarisePaymentsEur reports nothing-known on an empty table', () => {
  const summary = summarisePaymentsEur({});
  assert.equal(summary.grossKnown, false);
  assert.equal(summary.feeKnown, false);
  assert.equal(summary.earningsKnown, false);
  assert.equal(summary.taxKnown, false);
  assert.equal(summary.gross, 0);
  assert.equal(summary.tax, 0);
  assert.equal(summary.exact, false);
});

// The whole point of breaking VAT out as its own tile: the money tiles have to
// add up. A real live transaction (12.87 EUR gross, 1.07 fee, 9.23 earnings)
// leaves 2.57 unaccounted for unless VAT is shown — that gap read as
// unexplained shrinkage on the admin dashboard before this existed.
test('summarisePaymentsEur tiles reconcile: gross = tax + fee + earnings', () => {
  const summary = summarisePaymentsEur({
    totals: [{ currency: 'EUR', total: '12.87' }],
    feeTotals: [{ currency: 'EUR', total: '1.07', gross: '12.87' }],
    earningsTotals: [{ currency: 'EUR', total: '9.23', gross: '12.87' }],
    taxTotals: [{ currency: 'EUR', total: '2.57', gross: '12.87' }],
  }, RATES);

  assert.ok(Math.abs(summary.gross - (summary.tax + summary.fee + summary.earnings)) < 1e-9);
  // ...and the take-home rate the page renders off these figures.
  assert.equal(((summary.earnings / summary.earningsGross) * 100).toFixed(1), '71.7');
});

const ECB_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-09-01'>
      <Cube currency='USD' rate='1.1590'/>
      <Cube currency='GBP' rate='0.85655'/>
      <Cube currency='JPY' rate='185.63'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

test('parseEcbXml inverts "per EUR" rates into currency->EUR multipliers', () => {
  const { rates, asOf } = parseEcbXml(ECB_SAMPLE);
  assert.equal(asOf, '2026-09-01');
  assert.equal(rates.EUR, 1);
  assert.equal(rates.USD, 1 / 1.159);
  assert.equal(rates.GBP, 1 / 0.85655);
  // sanity: converting a USD amount lands below its nominal value at >1 USD/EUR
  assert.ok(toEur(100, 'USD', rates) < 100);
});

test('parseEcbXml on garbage still yields a usable EUR-only map, no throw', () => {
  const { rates, asOf } = parseEcbXml('<html>not the file you were looking for</html>');
  assert.deepEqual(rates, { EUR: 1 });
  assert.equal(asOf, null);
});
