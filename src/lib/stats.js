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

/**
 * The boundary between "they'd buy this, just cheaper" and "they don't want
 * this at any price you'd charge", as a fraction of the price they were
 * actually shown.
 *
 * 0.7 is a judgement call, not a derived constant — so the UI shows the raw
 * counts and the median gap alongside the split, and the creator can disagree
 * with the cut and still read their own numbers. Same principle as
 * pricingConfidence(): show the boring inputs, never just the verdict.
 */
const WINNABLE_RATIO = 0.7;

/**
 * Splits the NO responses into price objections and value objections.
 *
 * A no-sayer who was shown $29 and suggested $25 is telling you something
 * completely different from one who suggested $4, but `summariseSuggestedPrices`
 * pools them into a single median and loses that distinction. This compares
 * every suggestion against the price THAT respondent actually saw — which is
 * the only fair comparison, since each respondent sees exactly one price.
 *
 * Returns `{ enoughData: false }` rather than a split when too few no-sayers
 * named a price; a 1-vs-1 split rendered as two percentages would look like a
 * finding and is pure noise.
 */
export function analyseObjections(variants, responses) {
  const amountById = new Map(variants.map((v) => [v.id, Number(v.amount)]));
  const nos = responses.filter((r) => r.answer === 'no');

  const priced = [];
  for (const r of nos) {
    const asked = amountById.get(r.price_variant_id);
    const suggested = Number(r.suggested_price);
    // A free variant would make the ratio meaningless (divide by zero), and a
    // suggestion above the asking price isn't an objection at all — clamp the
    // ratio's usefulness rather than letting either distort the split.
    if (!Number.isFinite(asked) || asked <= 0) continue;
    if (r.suggested_price === null || r.suggested_price === undefined) continue;
    if (!Number.isFinite(suggested) || suggested < 0) continue;
    priced.push({ asked, suggested, ratio: suggested / asked, gap: asked - suggested });
  }

  const totalNos = nos.length;
  const silent = totalNos - priced.length;

  if (priced.length < 4) {
    return { enoughData: false, totalNos, silent, answered: priced.length };
  }

  const winnable = priced.filter((p) => p.ratio >= WINNABLE_RATIO);
  const valueGap = priced.filter((p) => p.ratio < WINNABLE_RATIO);

  const winnableGaps = winnable.map((p) => p.gap).sort((a, b) => a - b);
  const winnablePrices = winnable.map((p) => p.suggested).sort((a, b) => a - b);

  return {
    enoughData: true,
    totalNos,
    silent,
    answered: priced.length,
    winnable: winnable.length,
    valueGap: valueGap.length,
    winnableRate: percent(winnable.length, priced.length),
    // null when nobody landed in the winnable bucket — the UI must not print
    // a median of an empty set as "$0", which would read as a real finding.
    medianWinnableGap: winnableGaps.length ? median(winnableGaps) : null,
    medianWinnablePrice: winnablePrices.length ? median(winnablePrices) : null,
    thresholdRatio: WINNABLE_RATIO,
  };
}

/**
 * The same modelled revenue the price table already shows, re-cut as the
 * decision it actually implies: charge more and reach fewer people, or charge
 * less and reach more.
 *
 * Deliberately names BOTH prices instead of one winner. `recommendPrice`
 * already picks the revenue-maximising price; this exists because
 * revenue-maximising is only the right goal for some creators, and the report
 * shouldn't quietly assume it is.
 *
 * Returns null when fewer than two prices have responses — there is no
 * trade-off to show, and a "comparison" of one price against itself is noise.
 */
export function comparePricingStrategies(priceStats) {
  const usable = priceStats.filter((p) => p.responses > 0);
  if (usable.length < 2) return null;

  const revenueMax = [...usable].sort((a, b) => b.modelledRevenue - a.modelledRevenue)[0];
  // Ties on yes-rate break toward the higher price: if two prices convert
  // identically, the cheaper one is strictly worse for the creator, and
  // presenting it as "the reach play" would be actively bad advice.
  const volumeMax = [...usable].sort((a, b) => b.yesRate - a.yesRate || b.amount - a.amount)[0];

  const sameChoice = revenueMax.id === volumeMax.id;

  // Customers per 1,000 visitors — same 1,000-visitor basis modelledRevenue
  // uses, so the two numbers in this block are always directly comparable.
  const customersAt = (p) => (p.yesRate * 1000) / 100;

  return {
    sameChoice,
    revenueMax,
    volumeMax,
    revenueMaxCustomers: customersAt(revenueMax),
    volumeMaxCustomers: customersAt(volumeMax),
    // Guarded: a zero-revenue reach play (nobody said yes at that price)
    // would make this Infinity and render as a nonsense uplift.
    revenueUplift:
      volumeMax.modelledRevenue > 0
        ? ((revenueMax.modelledRevenue - volumeMax.modelledRevenue) / volumeMax.modelledRevenue) * 100
        : null,
    reachLoss: customersAt(volumeMax) - customersAt(revenueMax),
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
 *
 * `askConfidence`/`askSuggestedPrice` mirror the test's own follow-up
 * toggles. A follow-up the creator turned off is not "answered badly" — it
 * was never asked — so its component is dropped from BOTH the earned and
 * the available points and the remaining components are renormalised back
 * onto the 0–100 scale, rather than either scoring it 0 (a false penalty)
 * or handing it a synthetic neutral value (a false credit). This is
 * distinct from "asked but no usable answers yet" (e.g. zero yes responses
 * with `askConfidence` on): that case keeps scoring the real, computed
 * value — including a real 0 — same as before. Only an actually-disabled
 * follow-up is excluded from the denominator.
 */
export function pricingConfidence(
  priceStats,
  confidence,
  suggested,
  { askConfidence = true, askSuggestedPrice = true } = {},
) {
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

  // Sample size and balance are always applicable — they describe the
  // response set itself, not a follow-up question. Only intent/agreement
  // are gated on their respective toggles.
  const components = [
    { key: 'sample', enabled: true, earned: sampleScore, max: 40 },
    { key: 'balance', enabled: true, earned: balanceScore, max: 15 },
    { key: 'intent', enabled: askConfidence, earned: intentScore, max: 25 },
    { key: 'agreement', enabled: askSuggestedPrice, earned: agreementScore, max: 20 },
  ];
  const active = components.filter((c) => c.enabled);

  // Round each active part first, then derive the header from those rounded
  // parts — never from the raw sum. Rounding the sum independently of the
  // parts is exactly how a header can disagree with the breakdown sitting
  // right below it (e.g. a raw 79.4 rounds to 79 while its four rounded
  // parts sum to 80). A disabled part has no key in `parts` at all — the UI
  // uses that absence to render "not asked" instead of a bar/score.
  const parts = {};
  active.forEach((c) => {
    parts[c.key] = Math.round(c.earned);
  });

  const earnedPoints = active.reduce((sum, c) => sum + parts[c.key], 0);
  const availablePoints = active.reduce((sum, c) => sum + c.max, 0);
  const score =
    availablePoints > 0 ? Math.max(0, Math.min(100, Math.round((earnedPoints / availablePoints) * 100))) : 0;

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

/**
 * Which truthful, dynamic sales signal the locked page should lead with
 * (WYBY-02 §5). Compares the recommendation computed from only the free
 * snapshot against the one computed from every response collected so far.
 * Every branch here must only ever claim something the current data actually
 * supports — never "your leading price changed" unless it demonstrably did.
 */
export function compareRecommendations(freeRecommendation, currentRecommendation) {
  if (!currentRecommendation.enoughData) return 'still_building';
  if (!currentRecommendation.isClearWinner) return 'now_close';
  if (!freeRecommendation.enoughData) return 'now_has_leader';
  if (freeRecommendation.winner?.id !== currentRecommendation.winner?.id) return 'leader_changed';
  return 'leader_holding';
}

/**
 * `test` supplies `ask_confidence`/`ask_suggested_price` so `pricingConfidence`
 * can exclude a disabled follow-up's component instead of scoring it as a
 * bad answer. Optional (defaults both toggles on) so any other caller that
 * doesn't have a `test` row yet keeps today's full-weight behaviour.
 */
export function buildReport(variants, responses, test = {}) {
  const priceStats = summarisePriceVariants(variants, responses);
  const confidence = summariseConfidence(responses);
  const suggested = summariseSuggestedPrices(responses);
  const recommendation = recommendPrice(priceStats);
  const askConfidence = test.ask_confidence !== false;
  const askSuggestedPrice = test.ask_suggested_price !== false;

  return {
    priceStats,
    confidence,
    suggested,
    recommendation,
    pricingConfidence: pricingConfidence(priceStats, confidence, suggested, { askConfidence, askSuggestedPrice }),
    // Computed on every report, paid or free — these are pure functions over
    // rows already in memory, so there's no cost to it. Whether they're
    // RENDERED is the paywall's decision (see the `locked` fork in
    // r/[token]/page.js), never this function's.
    objections: analyseObjections(variants, responses),
    strategies: comparePricingStrategies(priceStats),
    totalResponses: responses.length,
  };
}
