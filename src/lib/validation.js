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
};
const MAX_IMAGES = 5;

function cleanText(value, max, { preserveNewlines = false } = {}) {
  if (typeof value !== 'string') return '';
  // Strip control characters; they have no business in user-facing copy.
  // "Included items" is newline-delimited ("one per line" -> checkmark list in
  // OfferCard), so \n must survive here or every line collapses into one item.
  const normalized = preserveNewlines ? value.replace(/\r\n?/g, '\n') : value;
  const controlChars = preserveNewlines
    ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  return normalized.replace(controlChars, '').trim().slice(0, max);
}

/**
 * A dotted, registrable-looking host: one or more labels then a 2+ letter TLD.
 * `new URL()` alone is not a link check — once the missing scheme is filled in
 * below, `not-a-valid-url` parses perfectly as a host and only fails much
 * later, as a DNS error in a respondent's browser on the live test page, where
 * nobody is watching. IDN hosts are already punycoded by `URL`, so they match;
 * bare hostnames (`localhost`) and raw IPs deliberately do not — this link is
 * published to strangers on the internet.
 */
const REGISTRABLE_HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return REGISTRABLE_HOSTNAME.test(url.hostname);
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

  const includedItems = cleanText(body.includedItems, LIMITS.includedItems, { preserveNewlines: true }) || null;

  let productUrl = cleanText(body.productUrl, LIMITS.productUrl) || null;
  if (productUrl && !isSafeHttpUrl(productUrl)) {
    productUrl = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`;
    if (!isSafeHttpUrl(productUrl)) {
      errors.productUrl = 'That is not a working link. Use the full address, like https://yourproduct.com.';
    }
  }

  const currency = config.currencies.some((c) => c.code === body.currency) ? body.currency : 'USD';
  const billingType = ['one_time', 'per_month', 'per_year'].includes(body.billingType)
    ? body.billingType
    : 'one_time';

  // A creator authoring a price list is the opposite case to a respondent
  // mid-vote (see `validateResponseInput`, where silently dropping a nonsense
  // suggested price is right because losing the vote would be worse). Here the
  // creator is watching, will act on what we say, and is about to send this
  // test to real people — so a price we cannot use has to be named, never
  // dropped on the floor. Dropping it silently produced a test that quietly
  // measured fewer prices than the creator believed it did, and, when every
  // price was rejected, the flatly untrue "Add at least one price to test."
  const rawPrices = Array.isArray(body.prices) ? body.prices : [];
  const prices = [];
  let sawTooHigh = false;
  let sawUnparseable = false;
  for (const raw of rawPrices) {
    // An empty input is an untouched spare row on the form, not a mistake.
    const text = String(raw ?? '').trim();
    if (!text) continue;
    const amount = Number.parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      sawUnparseable = true;
      continue;
    }
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > config.maxSuggestedPrice) {
      sawTooHigh = true;
      continue;
    }
    if (!prices.includes(rounded)) prices.push(rounded);
  }
  if (sawTooHigh) {
    errors.prices = `Keep each price under ${config.maxSuggestedPrice.toLocaleString('en-US')}.`;
  } else if (sawUnparseable) {
    errors.prices = 'Enter each price as a number above zero, like 29.';
  } else if (!prices.length) {
    errors.prices = 'Add at least one price to test.';
  }
  if (prices.length > config.maxPriceVariants) {
    errors.prices = `Test up to ${config.maxPriceVariants} prices in one go.`;
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
