import { config } from './config.js';

/**
 * Every external input is validated here before it reaches the database.
 * Returns { ok: true, value } or { ok: false, errors: {field: message} }.
 */

const LIMITS = {
  title: 80,
  description: 400,
  includedItems: 600,
  productUrl: 500,
  email: 200,
};
const MAX_IMAGES = 5;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Strip control characters; they have no business in user-facing copy.
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateTestInput(body) {
  const errors = {};

  const title = cleanText(body.title, LIMITS.title);
  if (title.length < 2) errors.title = 'Give it a name (at least 2 characters).';

  const description = cleanText(body.description, LIMITS.description);
  if (description.length < 5) errors.description = 'Describe it in a sentence or two.';

  const includedItems = cleanText(body.includedItems, LIMITS.includedItems) || null;

  let productUrl = cleanText(body.productUrl, LIMITS.productUrl) || null;
  if (productUrl && !isSafeHttpUrl(productUrl)) {
    productUrl = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`;
    if (!isSafeHttpUrl(productUrl)) errors.productUrl = 'That does not look like a valid link.';
  }

  const currency = config.currencies.some((c) => c.code === body.currency) ? body.currency : 'USD';
  const billingType = ['one_time', 'per_month', 'per_year'].includes(body.billingType)
    ? body.billingType
    : 'one_time';

  const rawPrices = Array.isArray(body.prices) ? body.prices : [];
  const prices = [];
  for (const raw of rawPrices) {
    const amount = Number.parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > config.maxSuggestedPrice) continue;
    if (!prices.includes(rounded)) prices.push(rounded);
  }
  if (!prices.length) errors.prices = 'Add at least one price to test.';
  if (prices.length > config.maxPriceVariants) {
    errors.prices = `Test up to ${config.maxPriceVariants} prices in one go.`;
  }

  let email = cleanText(body.email, LIMITS.email).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'That email does not look right.';
  }

  const suppliedImages = Array.isArray(body.imageUrls)
    ? body.imageUrls
    : typeof body.imageUrl === 'string'
      ? [body.imageUrl]
      : [];
  if (suppliedImages.length > MAX_IMAGES) errors.images = `Add up to ${MAX_IMAGES} product images.`;

  // Only our own upload paths are accepted — never an arbitrary remote URL.
  const imageUrls = [...new Set(suppliedImages)]
    .filter((imageUrl) => typeof imageUrl === 'string' && /^\/uploads\/[A-Za-z0-9_-]+\.webp$/.test(imageUrl))
    .slice(0, MAX_IMAGES);

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      description,
      includedItems,
      imageUrl: imageUrls[0] || null,
      imageUrls,
      productUrl,
      currency,
      billingType,
      prices: prices.sort((a, b) => a - b),
      askSuggestedPrice: body.askSuggestedPrice !== false,
      askConfidence: body.askConfidence !== false,
      email,
    },
  };
}

export function validateResponseInput(body) {
  const errors = {};

  const answer = body.answer === 'yes' || body.answer === 'no' ? body.answer : null;
  if (!answer) errors.answer = 'Answer must be yes or no.';

  let confidence = null;
  if (answer === 'yes' && body.confidence) {
    confidence = ['maybe', 'probably', 'would_pay'].includes(body.confidence) ? body.confidence : null;
  }

  let suggestedPrice = null;
  if (answer === 'no' && body.suggestedPrice !== null && body.suggestedPrice !== undefined && body.suggestedPrice !== '') {
    const parsed = Number.parseFloat(String(body.suggestedPrice).replace(',', '.'));
    // Silently drop nonsense rather than rejecting — a bad number should never
    // cost us an otherwise-valid vote.
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= config.maxSuggestedPrice) {
      suggestedPrice = Math.round(parsed * 100) / 100;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { answer, confidence, suggestedPrice } };
}
