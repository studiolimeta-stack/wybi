#!/usr/bin/env node
/**
 * One-off: seeds a demo test with 63 responses, deliberately left UNPAID, to
 * show what the results dashboard looks like for a creator who's collected
 * well past the free limit (30) and hasn't unlocked yet. Not part of the
 * regular seed-demo flow — run manually, clean up manually.
 *
 *   node scripts/seed-unpaid-63-demo.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl =
  process.env.DATABASE_URL ||
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='))
    .slice('DATABASE_URL='.length)
    .trim();

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const DEMO_TITLE = 'Unpaid Demo — 63 Responses';

const SLUG_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const slug = Array.from(randomBytes(7), (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
const creatorToken = randomBytes(24).toString('base64url');

const { rows: testRows } = await client.query(
  `INSERT INTO tests (slug, creator_token, title, description, included_items, currency,
                      billing_type, ask_suggested_price, ask_confidence, status, is_paid)
   VALUES ($1,$2,$3,$4,$5,'USD','per_month',TRUE,TRUE,'active',FALSE)
   RETURNING id`,
  [
    slug,
    creatorToken,
    DEMO_TITLE,
    'Sunday Reset Kit — a weekly meal-prep planner subscription.',
    'Weekly meal plan\nGrocery list\nPrep-day timer',
  ],
);
const testId = testRows[0].id;

const LADDER = [
  { amount: 9, asked: 16, yesRate: 0.5, strongShare: 0.3 },
  { amount: 14, asked: 16, yesRate: 0.38, strongShare: 0.32 },
  { amount: 19, asked: 16, yesRate: 0.25, strongShare: 0.24 },
  { amount: 24, asked: 15, yesRate: 0.13, strongShare: 0.2 },
];

let totalResponses = 0;

for (const [position, step] of LADDER.entries()) {
  const { rows: variantRows } = await client.query(
    'INSERT INTO price_variants (test_id, amount, position) VALUES ($1,$2,$3) RETURNING id',
    [testId, step.amount, position],
  );
  const variantId = variantRows[0].id;

  const yesCount = Math.round(step.asked * step.yesRate);

  for (let i = 0; i < step.asked; i += 1) {
    const isYes = i < yesCount;
    let confidence = null;
    let suggestedPrice = null;

    if (isYes) {
      const strongCount = Math.round(yesCount * step.strongShare);
      if (i < strongCount) confidence = 'would_pay';
      else if (i < strongCount + Math.round(yesCount * 0.35)) confidence = 'probably';
      else confidence = 'maybe';
    } else if (i % 3 === 0) {
      suggestedPrice = 8 + ((i * 5) % 10);
    }

    await client.query(
      `INSERT INTO responses (test_id, price_variant_id, answer, confidence, suggested_price,
                              visitor_id, device_type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval)`,
      [
        testId,
        variantId,
        isYes ? 'yes' : 'no',
        confidence,
        suggestedPrice,
        `demo-${randomBytes(8).toString('hex')}`,
        ['mobile', 'desktop', 'mobile', 'tablet'][i % 4],
        String((step.asked - i) * 9),
      ],
    );
    totalResponses += 1;
  }
}

console.log(`\nUnpaid demo test seeded — ${totalResponses} responses, is_paid=FALSE`);
console.log(`  results page : /r/${creatorToken}\n`);

await client.end();
