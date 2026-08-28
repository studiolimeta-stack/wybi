import { config } from './config.js';

/**
 * All pricing analysis. Pure functions over rows — no DB, no framework.
 * Every number here is deterministic and explainable; there is no model
 * and no AI anywhere in this file, by design (PRD §24).
 */

const STRONG_INTENT = 'would_pay';

function percent(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

/**
 * Per-price breakdown.
 *
 * `modelledRevenue` = price × yes-rate × 1000, i.e. expected revenue per
 * 1,000 visitors. It is a MODEL, not a forecast — the UI must label it so.
 *
 * `strongRevenue` uses only "I'd actually pay" responses. It is consistently
 * the more honest of the two, because a plain YES costs the respondent nothing.
 */
export function summarisePriceVariants(variants, responses) {
  return variants
    .map((variant) => {
      const forVariant = responses.filter((r) => r.price_variant_id === variant.id);
      const yes = forVariant.filter((r) => r.answer === 'yes');
      const strong = yes.filter((r) => r.confidence === STRONG_INTENT);

      const yesRate = percent(yes.length, forVariant.length);
      const strongRate = percent(strong.length, forVariant.length);

      return {
        id: variant.id,
        amount: Number(variant.amount),
        responses: forVariant.length,
        yes: yes.length,
        no: forVariant.length - yes.length,
        strong: strong.length,
        yesRate,
        strongRate,
        modelledRevenue: (Number(variant.amount) * yesRate * 1000) / 100,
        strongRevenue: (Number(variant.amount) * strongRate * 1000) / 100,
      };
    })
    .sort((a, b) => a.amount - b.amount);
}

/**
 * Names the best-performing TESTED price — never an untested one.
 *
 * Returns `{ enoughData: false }` until the sample can support a claim.
 * Showing a confident winner off seven responses is the fastest way to
 * make the whole product look like a toy, so we refuse instead.
 */
export function recommendPrice(priceStats) {
  const totalResponses = priceStats.reduce((sum, p) => sum + p.responses, 0);
  // Guard the empty case explicitly — Math.min(...counts, 0) would clamp every
  // result to zero and silently make `enoughData` unreachable.
  const thinnestVariant = priceStats.length ? Math.min(...priceStats.map((p) => p.responses)) : 0;

  const enoughData =
    totalResponses >= config.minResponsesForRecommendation &&
    thinnestVariant >= config.minResponsesPerVariant;

  const ranked = [...priceStats].sort((a, b) => b.modelledRevenue - a.modelledRevenue);
  const winner = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

  // A ~5% gap on a sample this size is noise, not a signal.
  const isClearWinner =
    winner && runnerUp
      ? winner.modelledRevenue > runnerUp.modelledRevenue * 1.05
      : Boolean(winner);

  return {
    enoughData,
    winner,
    isClearWinner,
    totalResponses,
    needed: {
      total: config.minResponsesForRecommendation,
      perVariant: config.minResponsesPerVariant,
      moreTotal: Math.max(0, config.minResponsesForRecommendation - totalResponses),
    },
  };
}

/** Distribution of prices volunteered by people who said NO. */
export function summariseSuggestedPrices(responses) {
  const values = responses
    .filter((r) => r.suggested_price !== null && r.suggested_price !== undefined)
    .map((r) => Number(r.suggested_price))
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);

  if (!values.length) return { count: 0 };

  return {
    count: values.length,
    median: median(values),
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: values[0],
    max: values[values.length - 1],
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
  };
}

export function summariseConfidence(responses) {
  const yes = responses.filter((r) => r.answer === 'yes');
  const total = responses.length;
  const count = (level) => yes.filter((r) => r.confidence === level).length;

  return {
    total,
    yes: yes.length,
    yesRate: percent(yes.length, total),
    maybe: count('maybe'),
    probably: count('probably'),
    wouldPay: count(STRONG_INTENT),
    maybeRate: percent(count('maybe'), total),
    probablyRate: percent(count('probably'), total),
    strongRate: percent(count(STRONG_INTENT), total),
  };
}

/**
 * Pricing Confidence, 0–100. PRD §27 allows dropping this if it turns
 * arbitrary — so it is deliberately built from four visible, boring inputs
 * and the UI shows the breakdown rather than just the number.
 */
export function pricingConfidence(priceStats, confidence, suggested) {
  const totalResponses = priceStats.reduce((sum, p) => sum + p.responses, 0);
  if (!totalResponses) return null;

  // 1. Sample size — full marks at 200 responses.
  const sampleScore = Math.min(1, totalResponses / 200) * 40;

  // 2. Balance — are the price groups comparable in size?
  const counts = priceStats.map((p) => p.responses);
  const balanceScore =
    counts.length > 1 ? (Math.min(...counts) / Math.max(...counts, 1)) * 15 : 15;

  // 3. Strength of intent — share who said "I'd actually pay".
  const intentScore = Math.min(1, confidence.strongRate / 25) * 25;

  // 4. Agreement — do the NO-sayers' suggested prices sit near a tested price?
  let agreementScore = 10;
  if (suggested.count >= 5) {
    const tested = priceStats.map((p) => p.amount);
    const nearest = Math.min(...tested.map((t) => Math.abs(t - suggested.median)));
    const spread = Math.max(...tested) - Math.min(...tested) || Math.max(...tested);
    agreementScore = Math.max(0, 1 - nearest / (spread || 1)) * 20;
  }

  // Round each part first, then derive the header from those rounded parts —
  // never from the raw sum. Rounding the sum independently of the parts is
  // exactly how a header can disagree with the breakdown sitting right below
  // it (e.g. a raw 79.4 rounds to 79 while its four rounded parts sum to 80).
  const parts = {
    sample: Math.round(sampleScore),
    balance: Math.round(balanceScore),
    intent: Math.round(intentScore),
    agreement: Math.round(agreementScore),
  };
  const score = Math.max(0, Math.min(100, parts.sample + parts.balance + parts.intent + parts.agreement));
  return { score, parts };
}

/**
 * View → answer funnel rate for the "Answer rate" stat tile on /r/[token].
 *
 * Refuses rather than misleads: a 0 denominator (no view-tracking data —
 * typically legacy/seeded responses inserted directly into `responses`
 * without ever going through the real view flow) or `answeredCount` above
 * `viewCount` (same cause — real traffic can never answer without first
 * being counted as a view, since both share the visitor_id cookie) both
 * mean the underlying data can't support an honest percentage. Return null
 * and let the caller skip rendering entirely, same philosophy
 * `recommendPrice()` already uses: refuse a number rather than show a wrong
 * one.
 */
export function computeAnswerRate(viewCount, answeredCount) {
  if (!viewCount || answeredCount > viewCount) return null;
  return (answeredCount / viewCount) * 100;
}

export function buildReport(variants, responses) {
  const priceStats = summarisePriceVariants(variants, responses);
  const confidence = summariseConfidence(responses);
  const suggested = summariseSuggestedPrices(responses);
  const recommendation = recommendPrice(priceStats);

  return {
    priceStats,
    confidence,
    suggested,
    recommendation,
    pricingConfidence: pricingConfidence(priceStats, confidence, suggested),
    totalResponses: responses.length,
  };
}
