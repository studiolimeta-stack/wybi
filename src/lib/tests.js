import { query, transaction } from './db.js';
import { generateSlug, generateCreatorToken } from './ids.js';
import { config } from './config.js';

/**
 * `sessionUserId`, when the creator is already logged in, owns the test
 * immediately. Otherwise the test is genuinely anonymous (`user_id = NULL`) —
 * `/create` no longer takes an optional email to pre-attach ownership; the
 * only way to attach a test to an account is the real login/signup flow
 * (claiming from `wybi_mine`, or the explicit `/r/[token]` cross-device
 * claim), never an unverified email typed into a form. See the "Revised
 * Preview + Account Flow" spec, §7.
 */
export async function createTest(input, { sessionUserId = null } = {}) {
  return transaction(async (client) => {
    const userId = sessionUserId;

    // Slug collisions are astronomically unlikely but cheap to retry.
    let test = null;
    for (let attempt = 0; attempt < 5 && !test; attempt += 1) {
      try {
        const { rows } = await client.query(
          `INSERT INTO tests
             (user_id, slug, creator_token, title, description, included_items,
              image_url, image_urls, product_url, currency, billing_type,
              ask_suggested_price, ask_confidence, free_response_limit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [
            userId,
            generateSlug(),
            generateCreatorToken(),
            input.title,
            input.description,
            input.includedItems || null,
            input.imageUrl || null,
            JSON.stringify(input.imageUrls || []),
            input.productUrl || null,
            input.currency,
            input.billingType,
            input.askSuggestedPrice,
            input.askConfidence,
            config.freeResponseLimit,
          ],
        );
        test = rows[0];
      } catch (err) {
        if (err.constraint === 'tests_slug_key') continue;
        throw err;
      }
    }
    if (!test) throw new Error('Could not allocate a unique test slug after 5 attempts');

    for (const [index, amount] of input.prices.entries()) {
      await client.query(
        'INSERT INTO price_variants (test_id, amount, position) VALUES ($1,$2,$3)',
        [test.id, amount, index],
      );
    }

    return test;
  });
}

export async function getTestBySlug(slug) {
  const { rows } = await query('SELECT * FROM tests WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

export async function getTestByCreatorToken(token) {
  const { rows } = await query('SELECT * FROM tests WHERE creator_token = $1', [token]);
  return rows[0] ?? null;
}

export async function getPriceVariants(testId) {
  const { rows } = await query(
    'SELECT * FROM price_variants WHERE test_id = $1 ORDER BY position, amount',
    [testId],
  );
  return rows;
}

export async function getResponses(testId) {
  const { rows } = await query(
    `SELECT price_variant_id, answer, confidence, suggested_price, created_at
     FROM responses WHERE test_id = $1 ORDER BY created_at`,
    [testId],
  );
  return rows;
}

export async function countResponses(testId) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM responses WHERE test_id = $1', [testId]);
  return rows[0].n;
}

export async function getExistingResponse(testId, visitorId) {
  const { rows } = await query(
    `SELECT r.*, pv.amount
     FROM responses r JOIN price_variants pv ON pv.id = r.price_variant_id
     WHERE r.test_id = $1 AND r.visitor_id = $2`,
    [testId, visitorId],
  );
  return rows[0] ?? null;
}

/**
 * Pins a visitor to exactly one price, on first view.
 *
 * Balancing counts SUBMITTED responses, not views — otherwise link previews,
 * crawlers and bounces would starve real respondents out of a variant.
 * The whole thing runs in one transaction with a row lock on the test so two
 * simultaneous visitors cannot both claim the same "emptiest" variant.
 */
export async function assignPriceVariant(testId, visitorId) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT pv.* FROM price_assignments pa
       JOIN price_variants pv ON pv.id = pa.price_variant_id
       WHERE pa.test_id = $1 AND pa.visitor_id = $2`,
      [testId, visitorId],
    );
    if (existing.rows.length) return existing.rows[0];

    await client.query('SELECT id FROM tests WHERE id = $1 FOR UPDATE', [testId]);

    const { rows: candidates } = await client.query(
      `SELECT pv.*, COUNT(r.id)::int AS response_count
       FROM price_variants pv
       LEFT JOIN responses r ON r.price_variant_id = pv.id
       WHERE pv.test_id = $1
       GROUP BY pv.id
       ORDER BY response_count ASC, random()`,
      [testId],
    );
    if (!candidates.length) throw new Error(`Test ${testId} has no price variants`);

    const chosen = candidates[0];
    await client.query(
      `INSERT INTO price_assignments (test_id, visitor_id, price_variant_id)
       VALUES ($1,$2,$3) ON CONFLICT (test_id, visitor_id) DO NOTHING`,
      [testId, visitorId, chosen.id],
    );
    return chosen;
  });
}

export async function submitResponse(payload) {
  const { rows } = await query(
    `INSERT INTO responses
       (test_id, price_variant_id, answer, confidence, suggested_price,
        visitor_id, ip_hash, referrer, utm_source, utm_medium, utm_campaign, device_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (test_id, visitor_id) DO NOTHING
     RETURNING id`,
    [
      payload.testId,
      payload.priceVariantId,
      payload.answer,
      payload.confidence,
      payload.suggestedPrice,
      payload.visitorId,
      payload.ipHash,
      payload.referrer,
      payload.utmSource,
      payload.utmMedium,
      payload.utmCampaign,
      payload.deviceType,
    ],
  );
  return rows[0] ?? null;
}

export async function setTestStatus(testId, status) {
  await query('UPDATE tests SET status = $2, updated_at = now() WHERE id = $1', [testId, status]);
}

export async function deleteTest(testId) {
  await query('DELETE FROM tests WHERE id = $1', [testId]);
}

export async function listTestsByTokens(tokens) {
  if (!tokens.length) return [];
  const { rows } = await query(
    `SELECT t.*,
            (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count,
            (SELECT COUNT(*)::int FROM price_variants pv WHERE pv.test_id = t.id) AS variant_count
     FROM tests t
     WHERE t.creator_token = ANY($1) AND t.status <> 'archived'
     ORDER BY t.created_at DESC`,
    [tokens],
  );
  return rows;
}

/**
 * Owned tests only, for the account page's billing summary — deliberately not
 * the cookie-union that listTestsForViewer does for the dashboard. Billing
 * status only makes sense for tests actually tied to this account.
 */
export async function listTestsByUserId(userId) {
  const { rows } = await query(
    `SELECT t.*,
            (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count
     FROM tests t
     WHERE t.user_id = $1 AND t.status <> 'archived'
     ORDER BY t.created_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * The dashboard's query for one union: tests owned by this account PLUS
 * whatever this browser remembers creating anonymously, deduplicated.
 *
 * Works identically for a logged-out visitor (userId null — the user_id
 * comparison simply never matches) and a logged-in one, so /dashboard needs no
 * branching query logic, only different copy around the same list.
 */
export async function listTestsForViewer({ userId = null, creatorTokens = [] }) {
  const { rows } = await query(
    `SELECT t.*,
            (SELECT COUNT(*)::int FROM responses r WHERE r.test_id = t.id) AS response_count,
            (SELECT COUNT(*)::int FROM price_variants pv WHERE pv.test_id = t.id) AS variant_count
     FROM tests t
     WHERE t.status <> 'archived' AND (t.user_id = $1 OR t.creator_token = ANY($2))
     ORDER BY t.created_at DESC`,
    [userId, creatorTokens],
  );
  return rows;
}

export async function reportTest(testId, reason, visitorId) {
  await transaction(async (client) => {
    await client.query(
      'INSERT INTO test_reports (test_id, reason, visitor_id) VALUES ($1,$2,$3)',
      [testId, reason, visitorId],
    );
    await client.query('UPDATE tests SET reported_count = reported_count + 1 WHERE id = $1', [testId]);
  });
}

/**
 * Sliding-window per-IP throttle. Backed by a table — no Redis needed at this
 * scale, and it keeps the whole stack to one dependency.
 *
 * `bucket` is a key of config.rateLimits.
 */
export async function checkRateLimit(bucket, ipHash) {
  if (!ipHash) return true;

  const [limit, windowSeconds] = config.rateLimits[bucket];

  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM rate_limit_hits
     WHERE bucket = $1 AND ip_hash = $2 AND created_at > now() - ($3 || ' seconds')::interval`,
    [bucket, ipHash, String(windowSeconds)],
  );
  if (rows[0].n >= limit) return false;

  await query('INSERT INTO rate_limit_hits (bucket, ip_hash) VALUES ($1,$2)', [bucket, ipHash]);

  // The table is write-only otherwise and would grow without bound. Pruning on
  // a small fraction of requests keeps it bounded without needing a cron job.
  if (Math.random() < 0.01) {
    query("DELETE FROM rate_limit_hits WHERE created_at < now() - interval '24 hours'").catch((err) =>
      console.error(`rate_limit_prune_failed: ${err.message}`),
    );
  }

  return true;
}

/** Analysis is gated once a free test passes its response limit (PRD §32/§34). */
export function isReportLocked(test, responseCount) {
  return !test.is_paid && responseCount > test.free_response_limit;
}
