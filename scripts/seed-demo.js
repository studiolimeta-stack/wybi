#!/usr/bin/env node
/**
 * Seeds one realistic demo test so the results page can be reviewed with
 * believable numbers. Demand slopes downward with price, as it does in reality.
 *
 *   node scripts/seed-demo.js          # create
 *   node scripts/seed-demo.js --clean  # remove previous demo tests first
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

const DEMO_TITLE = 'InvoiceAI Pro (demo)';

if (process.argv.includes('--clean')) {
  const { rowCount } = await client.query('DELETE FROM tests WHERE title = $1', [DEMO_TITLE]);
  console.log(`removed ${rowCount} previous demo test(s)`);
}

const SLUG_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const slug = Array.from(randomBytes(7), (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
const creatorToken = randomBytes(24).toString('base64url');

const { rows: testRows } = await client.query(
  `INSERT INTO tests (slug, creator_token, title, description, included_items, currency,
                      billing_type, ask_suggested_price, ask_confidence, status, is_paid)
   VALUES ($1,$2,$3,$4,$5,'EUR','per_month',TRUE,TRUE,'active',TRUE)
   RETURNING id`,
  [
    slug,
    creatorToken,
    DEMO_TITLE,
    'An invoicing tool for freelancers that automatically categorises expenses.',
    'Unlimited invoices\n5 users\nAI categorisation\nPDF export',
  ],
);
const testId = testRows[0].id;

// Yes-rate falls as price rises; strong intent falls faster still.
const LADDER = [
  { amount: 19, asked: 47, yesRate: 0.45, strongShare: 0.3 },
  { amount: 29, asked: 46, yesRate: 0.35, strongShare: 0.34 },
  { amount: 39, asked: 45, yesRate: 0.2, strongShare: 0.22 },
  { amount: 49, asked: 45, yesRate: 0.09, strongShare: 0.25 },
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
      // Willingness to pay clusters in the low twenties regardless of price shown.
      suggestedPrice = 15 + ((i * 7) % 13);
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
        String((step.asked - i) * 11),
      ],
    );
    totalResponses += 1;
  }
}

console.log(`\nDemo test seeded — ${totalResponses} responses`);
console.log(`  respondent page : /t/${slug}`);
console.log(`  results page    : /r/${creatorToken}\n`);

await client.end();
