#!/usr/bin/env node
/**
 * Regression tests for what a respondent is allowed to receive.
 *
 * `/t/[slug]` is the one URL a creator deliberately sends to strangers, and
 * everything passed across a client-component boundary on it is readable in the
 * page source. Two invariants matter more than anything else on that page:
 * the creator's token must not be in it, and the prices the respondent was not
 * assigned must not be in it.
 *
 * Both were broken at once by a single `<RespondFlow test={test} />` passing a
 * raw `SELECT *` row to a client component, which put `creator_token` in the
 * RSC payload of every test link — full read/export/pause/delete for anyone who
 * viewed source. These tests exist so that stays fixed.
 *
 *   node --test scripts/test-respondent-privacy.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicTestView } from '../src/lib/tests.js';
import { validateTestInput } from '../src/lib/validation.js';

/** Shaped exactly like a `SELECT * FROM tests` row, secrets included. */
const row = {
  id: 350,
  user_id: 42,
  slug: 'YG53EZC',
  creator_token: 'rnbH2yAOZrWvnljlz9PrEM1zuVtBIJq6',
  title: 'QA Bug Sweep Widget',
  description: 'A test offer.',
  included_items: 'Feature one\nFeature two',
  image_url: null,
  product_url: 'https://example.com/qa',
  currency: 'USD',
  billing_type: 'one_time',
  ask_suggested_price: true,
  ask_confidence: true,
  status: 'active',
  free_response_limit: 30,
  is_paid: false,
  reported_count: 0,
  created_at: new Date(),
  updated_at: new Date(),
  image_urls: [],
};

test('publicTestView never exposes the creator token', () => {
  const view = publicTestView(row);
  assert.equal(view.creator_token, undefined);
  // Belt and braces: the token must not survive anywhere in the serialised
  // payload, under any key, however the shape is refactored later.
  assert.ok(!JSON.stringify(view).includes(row.creator_token));
});

test('publicTestView is an allowlist — a new secret column is invisible by default', () => {
  // The failure mode being guarded against: someone adds a column to `tests`
  // and every respondent starts receiving it. An allowlist means new columns
  // are excluded until named, so this test keeps passing untouched.
  const view = publicTestView({ ...row, internal_admin_note: 'do not ship this' });
  assert.equal(view.internal_admin_note, undefined);
});

test('publicTestView drops internal bookkeeping the respondent has no business seeing', () => {
  const view = publicTestView(row);
  for (const key of ['id', 'user_id', 'is_paid', 'reported_count', 'free_response_limit', 'status']) {
    assert.equal(view[key], undefined, `${key} should not reach the respondent`);
  }
});

test('publicTestView omits product_url — nothing on the respondent page renders it', () => {
  assert.equal(publicTestView(row).product_url, undefined);
});

test('publicTestView still carries everything OfferCard renders', () => {
  const view = publicTestView(row);
  for (const key of ['title', 'description', 'included_items', 'image_url', 'image_urls', 'currency', 'billing_type']) {
    assert.ok(key in view, `${key} is needed to render the offer`);
  }
});

test('publicTestView passes null through rather than inventing an empty object', () => {
  assert.equal(publicTestView(null), null);
});

/*
 * Creator-side price validation. A price we cannot use must be named, never
 * dropped silently — the creator is about to send this test to real people and
 * would otherwise believe it measures prices it does not.
 */

const baseInput = { title: 'A product', description: 'Something worth buying.' };

test('a price above the maximum is reported, not silently dropped', () => {
  const result = validateTestInput({ ...baseInput, prices: ['2000000'] });
  assert.equal(result.ok, false);
  // The old behaviour claimed "Add at least one price to test." — untrue, they had.
  assert.match(result.errors.prices, /under/i);
  assert.doesNotMatch(result.errors.prices, /at least one/i);
});

test('a too-high price alongside a valid one still fails loudly', () => {
  // Silently keeping only $29 would produce a test measuring one price while
  // the creator believed it measured two.
  const result = validateTestInput({ ...baseInput, prices: ['29', '2000000'] });
  assert.equal(result.ok, false);
});

test('an unparseable price gets a message about numbers, not about emptiness', () => {
  const result = validateTestInput({ ...baseInput, prices: ['abc'] });
  assert.equal(result.ok, false);
  assert.match(result.errors.prices, /number/i);
});

test('zero and negative prices are rejected as numbers, not as absence', () => {
  for (const bad of ['0', '-5']) {
    const result = validateTestInput({ ...baseInput, prices: [bad] });
    assert.equal(result.ok, false, `${bad} should be rejected`);
    assert.match(result.errors.prices, /number/i);
  }
});

test('genuinely empty input still says to add a price', () => {
  const result = validateTestInput({ ...baseInput, prices: ['', '  '] });
  assert.equal(result.ok, false);
  assert.match(result.errors.prices, /at least one/i);
});

test('untouched spare price rows do not invalidate a valid price', () => {
  // The create form always submits its full set of price inputs; the unused
  // ones arrive as empty strings and must not read as mistakes.
  const result = validateTestInput({ ...baseInput, prices: ['19', '', '39', ''] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.prices, [19, 39]);
});

test('comma decimals and duplicates still behave as before', () => {
  const result = validateTestInput({ ...baseInput, prices: ['19,50', '19.50', '39'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.prices, [19.5, 39]);
});

test('too many prices still reports the variant cap', () => {
  const result = validateTestInput({ ...baseInput, prices: ['1', '2', '3', '4', '5', '6'] });
  assert.equal(result.ok, false);
  assert.match(result.errors.prices, /up to/i);
});
