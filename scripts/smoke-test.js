#!/usr/bin/env node
/**
 * End-to-end smoke test against a running instance.
 *
 * Exercises the parts that are easy to get subtly wrong and hard to eyeball:
 * price-variant balancing, price pinning across reloads, and duplicate-vote
 * rejection. Creates one throwaway test and deletes it on the way out.
 *
 *   node scripts/smoke-test.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:4003';

let failures = 0;
function check(label, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${status}] ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Minimal cookie jar: one simulated browser per instance. */
function newBrowser() {
  const jar = new Map();
  return {
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));

      const res = await fetch(`${BASE}${path}`, { ...options, headers, redirect: 'manual' });
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
      return res;
    },
  };
}

const PRICES = [19, 29, 39, 49];
const RESPONDENT_COUNT = 40;

console.log(`\nSmoke test → ${BASE}\n`);

// 1. Create a test.
const creator = newBrowser();
const createRes = await creator.fetch('/api/tests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Smoke Test Offer',
    description: 'Automated end-to-end check. Safe to delete.',
    includedItems: 'Thing one\nThing two',
    currency: 'EUR',
    billingType: 'per_month',
    prices: PRICES,
    askConfidence: true,
    askSuggestedPrice: true,
  }),
});
const created = await createRes.json();
check('test created', createRes.status === 201 && created.slug, `slug=${created.slug}`);
if (!created.slug) process.exit(1);

const { slug, creatorToken } = created;

// 2. Reject bad input.
const badRes = await creator.fetch('/api/tests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'x', description: '', prices: [] }),
});
check('invalid input rejected', badRes.status === 422);

// 3. Drive respondents through the flow.
const seenPrices = [];
for (let i = 0; i < RESPONDENT_COUNT; i += 1) {
  const visitor = newBrowser();

  const view = await visitor.fetch(`/t/${slug}`);
  const html = await view.text();
  // Currency-symbol-agnostic on purpose: the test below runs in EUR, and a
  // hardcoded `$` here would silently match nothing and turn every check
  // downstream into a false failure rather than a real one.
  const shown = [...html.matchAll(/[$€£](\d+)\/month/g)].map((m) => Number(m[1]));
  seenPrices.push(shown[0]);

  // Reloading must never change the price a respondent was shown.
  if (i === 0) {
    const reload = await visitor.fetch(`/t/${slug}`);
    const reloadPrice = Number((await reload.text()).match(/[$€£](\d+)\/month/)?.[1]);
    check('price is pinned across reloads', reloadPrice === shown[0], `${shown[0]} → ${reloadPrice}`);
  }

  const answer = i % 3 === 0 ? 'yes' : 'no';
  const postRes = await visitor.fetch('/api/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, answer }),
  });
  const posted = await postRes.json();
  if (i === 0) check('response accepted', postRes.ok && posted.duplicate === false);

  await visitor.fetch('/api/respond', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      answer === 'yes'
        ? { slug, confidence: ['maybe', 'probably', 'would_pay'][i % 3] }
        : { slug, suggestedPrice: 15 + (i % 7) },
    ),
  });

  // Same browser voting twice must be a no-op.
  if (i === 0) {
    const dupRes = await visitor.fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, answer: 'yes' }),
    });
    const dup = await dupRes.json();
    check('duplicate vote suppressed', dup.duplicate === true);
  }
}

// 4. Balance across variants.
const counts = PRICES.map((price) => seenPrices.filter((p) => p === price).length);
const spread = Math.max(...counts) - Math.min(...counts);
check('prices balanced across respondents', spread <= 2, `counts=[${counts.join(', ')}] spread=${spread}`);
check('every price variant used', counts.every((c) => c > 0));

// 5. Results and paywall.
const resultsHtml = await (await creator.fetch(`/r/${creatorToken}`)).text();
check('results page renders', resultsHtml.includes('Smoke Test Offer'));
check(
  `paywall engaged past free limit (${RESPONDENT_COUNT} responses)`,
  resultsHtml.includes('Unlock the full report'),
);

const exportRes = await creator.fetch(`/api/tests/${creatorToken}/export`);
check('CSV export blocked while locked', exportRes.status === 402);

// 6. Pause closes the door.
await creator.fetch(`/api/tests/${creatorToken}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'paused' }),
});
const pausedVisitor = newBrowser();
await pausedVisitor.fetch(`/t/${slug}`);
const pausedRes = await pausedVisitor.fetch('/api/respond', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, answer: 'yes' }),
});
check('paused test refuses responses', pausedRes.status === 409);

// 7. Clean up.
const deleteRes = await creator.fetch(`/api/tests/${creatorToken}`, { method: 'DELETE' });
check('test deleted', deleteRes.ok);
check('deleted test 404s', (await creator.fetch(`/t/${slug}`)).status === 404);

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
