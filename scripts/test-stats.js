#!/usr/bin/env node
/**
 * Unit tests for the pricing maths — the one part of this app where a silent
 * wrong answer is worse than a crash, because a creator would act on it.
 *
 *   node --test scripts/test-stats.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarisePriceVariants,
  summariseSuggestedPrices,
  summariseConfidence,
  recommendPrice,
  median,
  pricingConfidence,
} from '../src/lib/stats.js';

const variants = [
  { id: 1, amount: 19 },
  { id: 2, amount: 29 },
  { id: 3, amount: 39 },
];

/** Builds `count` responses for a variant, `yes` of which are positive. */
function responsesFor(variantId, count, yes, confidence = null) {
  return Array.from({ length: count }, (_, i) => ({
    price_variant_id: variantId,
    answer: i < yes ? 'yes' : 'no',
    confidence: i < yes ? confidence : null,
    suggested_price: null,
  }));
}

test('yes rate and modelled revenue per price', () => {
  const responses = [...responsesFor(1, 10, 4), ...responsesFor(2, 10, 3), ...responsesFor(3, 10, 1)];
  const stats = summarisePriceVariants(variants, responses);

  assert.equal(stats[0].yesRate, 40);
  // Literal expectations, not `19 * 0.4 * 1000` — that expression is itself
  // float-lossy (7600.000000000001), which would make the test wrong, not the code.
  assert.equal(stats[0].modelledRevenue, 7600);
  assert.equal(stats[1].modelledRevenue, 8700);
  // $29 at 30% beats $19 at 40% — the whole point of the metric.
  assert.ok(stats[1].modelledRevenue > stats[0].modelledRevenue);
});

test('prices are always returned in ascending order', () => {
  const shuffled = [
    { id: 3, amount: 39 },
    { id: 1, amount: 19 },
    { id: 2, amount: 29 },
  ];
  const stats = summarisePriceVariants(shuffled, responsesFor(1, 5, 2));
  assert.deepEqual(
    stats.map((s) => s.amount),
    [19, 29, 39],
  );
});

test('a variant with zero responses does not divide by zero', () => {
  const stats = summarisePriceVariants(variants, responsesFor(1, 5, 2));
  assert.equal(stats[1].responses, 0);
  assert.equal(stats[1].yesRate, 0);
  assert.equal(stats[1].modelledRevenue, 0);
});

test('recommendation is withheld below the sample thresholds', () => {
  const thin = summarisePriceVariants(variants, [
    ...responsesFor(1, 3, 2),
    ...responsesFor(2, 3, 1),
    ...responsesFor(3, 3, 0),
  ]);
  const result = recommendPrice(thin);
  assert.equal(result.enoughData, false);
  assert.equal(result.totalResponses, 9);
  assert.equal(result.needed.moreTotal, 21);
});

test('recommendation is given once the sample is adequate', () => {
  // Regression guard: Math.min(...counts, 0) once clamped this to zero and made
  // `enoughData` unreachable no matter how many responses came in.
  const healthy = summarisePriceVariants(variants, [
    ...responsesFor(1, 20, 9),
    ...responsesFor(2, 20, 7),
    ...responsesFor(3, 20, 2),
  ]);
  const result = recommendPrice(healthy);

  assert.equal(result.enoughData, true);
  assert.equal(result.winner.amount, 29, '29 × 35% beats 19 × 45%');
  assert.equal(result.isClearWinner, true);
});

test('one thin variant blocks the recommendation even when the total is large', () => {
  const lopsided = summarisePriceVariants(variants, [
    ...responsesFor(1, 60, 20),
    ...responsesFor(2, 60, 20),
    ...responsesFor(3, 2, 1),
  ]);
  assert.equal(recommendPrice(lopsided).enoughData, false);
});

test('a near-tie is not reported as a clear winner', () => {
  const tied = summarisePriceVariants(
    [
      { id: 1, amount: 20 },
      { id: 2, amount: 21 },
    ],
    [...responsesFor(1, 30, 10), ...responsesFor(2, 30, 10)],
  );
  const result = recommendPrice(tied);
  assert.equal(result.enoughData, true);
  assert.equal(result.isClearWinner, false);
});

test('median handles odd and even counts', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('suggested price distribution', () => {
  const responses = [10, 20, 20, 30, 100].map((price) => ({
    price_variant_id: 1,
    answer: 'no',
    confidence: null,
    suggested_price: price,
  }));
  const summary = summariseSuggestedPrices(responses);

  assert.equal(summary.count, 5);
  assert.equal(summary.median, 20);
  assert.equal(summary.min, 10);
  assert.equal(summary.max, 100);
  // The median must resist the outlier that the average does not.
  assert.equal(summary.average, 36);
});

test('confidence rates are shares of everyone asked, not of the yeses', () => {
  const responses = [...responsesFor(1, 100, 20, 'would_pay')];
  const summary = summariseConfidence(responses);

  assert.equal(summary.yes, 20);
  assert.equal(summary.yesRate, 20);
  assert.equal(summary.wouldPay, 20);
  assert.equal(summary.strongRate, 20);
});

test('pricing confidence header always equals the sum of its own rounded parts', () => {
  // Regression fixture: the raw (unrounded) total is 23.145..., which rounds
  // to a header of 23 — but the four parts shown underneath it round to
  // 9 + 5 + 0 + 10 = 24. That one-point gap between the headline number and
  // its own visible breakdown is exactly what testers reproduced live.
  const priceStats = [
    { amount: 19, responses: 10 },
    { amount: 29, responses: 33 },
  ];
  const confidence = { strongRate: 0 };
  const suggested = { count: 0, median: 0 };

  const result = pricingConfidence(priceStats, confidence, suggested);
  const partsSum = result.parts.sample + result.parts.balance + result.parts.intent + result.parts.agreement;

  assert.equal(result.parts.sample, 9);
  assert.equal(result.parts.balance, 5);
  assert.equal(result.parts.intent, 0);
  assert.equal(result.parts.agreement, 10);
  assert.equal(result.score, partsSum, 'header must never disagree with its own breakdown');
  assert.equal(result.score, 24);
});
