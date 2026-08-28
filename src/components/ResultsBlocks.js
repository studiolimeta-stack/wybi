import { formatPrice, currencySymbol } from '../lib/config.js';

const pct = (value) => `${value.toFixed(value >= 10 ? 0 : 1)}%`;
const money = (value, currency) =>
  `${currencySymbol(currency)}${Math.round(value).toLocaleString('en-US')}`;

export function StatTile({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="hint mt-1">{sub}</p>}
    </div>
  );
}

const PRICE_COLUMNS = ['Price', 'Asked', 'Yes', 'Yes rate', 'Modelled revenue'];

/**
 * Card, scroll wrapper, header row and footnote — everything about the
 * per-price table except its data rows. Shared by the real table and by the
 * locked stand-in below so the paywalled page shows the identical shape
 * without a second copy of this markup to keep in sync.
 */
function PriceTableFrame({ caption, note, children }) {
  return (
    <div className="card overflow-hidden">
      {/* Scrolls rather than clips: at 390px the five columns do not fit, and
        * `overflow-hidden` alone put modelled revenue — the headline number of
        * the paid report — permanently off-screen on a phone. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b-2 border-ink bg-paper text-left">
              {PRICE_COLUMNS.map((label, index) => (
                <th
                  key={label}
                  className={`p-3 text-xs font-bold uppercase tracking-wider text-muted${index === 0 ? '' : ' text-right'}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <div className="space-y-1 p-3 border-t-2 border-ink bg-paper">
        <p className="hint">
          <strong>Modelled revenue</strong> estimates the relative revenue potential of each tested price based on
          respondents&apos; answers. It compares prices, not actual revenue.
        </p>
        {/* Explains the "Best" tag specifically — without this, a lower-yes-rate row
          * outranking a higher-yes-rate one on modelled revenue just looks wrong. */}
        {note && <p className="hint">{note}</p>}
      </div>
    </div>
  );
}

/**
 * Per-price results. The bar is the yes-rate; the modelled-revenue column is
 * what actually decides the winner, so it gets its own visual weight.
 */
export function PriceTable({ priceStats, test, winnerId }) {
  const maxRate = Math.max(...priceStats.map((p) => p.yesRate), 1);

  return (
    <PriceTableFrame
      note={
        winnerId
          ? 'Best = highest modelled revenue, not highest yes-rate — a lower yes-rate can still win if the higher price more than offsets it.'
          : null
      }
    >
      {priceStats.map((row) => (
        <tr key={row.id} className="border-b border-line last:border-0">
          <td className="p-3 font-extrabold whitespace-nowrap">
            {formatPrice(row.amount, test.currency, test.billing_type)}
            {row.id === winnerId && <span className="ml-2 pill bg-accent text-white border-accent">Best</span>}
          </td>
          <td className="p-3 text-right tabular-nums">{row.responses}</td>
          <td className="p-3 text-right tabular-nums">{row.yes}</td>
          <td className="p-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="w-14">
                <ConfidenceMeter value={row.yesRate} max={maxRate} color="var(--color-accent)" />
              </div>
              <span className="tabular-nums w-12 text-right">{pct(row.yesRate)}</span>
            </div>
          </td>
          <td className="p-3 text-right font-bold tabular-nums">{money(row.modelledRevenue, test.currency)}</td>
        </tr>
      ))}
    </PriceTableFrame>
  );
}

/* Fixed widths, identical on every row: a placeholder must not encode the
 * value it stands in for. Varying them per row would turn the redaction back
 * into a (crude) readout of the data it is meant to withhold. */
const REDACTED_CELL_WIDTHS = ['2rem', '2rem', '3.25rem', '4.5rem'];

/**
 * What the paywall shows in place of the per-price table.
 *
 * This used to be the real `PriceTable` wrapped in a CSS blur, which meant
 * every asked/yes/yes-rate/modelled-revenue figure of the $14.90 report was
 * sitting in plain text in the server-rendered HTML of a locked page — legible
 * to view-source, curl, or reader mode. Paywalled data has to be withheld
 * server-side, never merely obscured client-side. Only the creator's own price
 * ladder survives here (they entered it, and each respondent already sees one
 * of these prices); no analysis of it is rendered at all.
 */
export function LockedPriceTable({ variants, test }) {
  return (
    <PriceTableFrame caption="Per-price results, locked until you unlock the full report.">
      {variants.map((variant) => (
        <tr key={variant.id} className="border-b border-line last:border-0">
          <td className="p-3 font-extrabold whitespace-nowrap">
            {formatPrice(variant.amount, test.currency, test.billing_type)}
          </td>
          {REDACTED_CELL_WIDTHS.map((width, index) => (
            <td key={index} className="p-3">
              <span className="locked-cell ml-auto" style={{ width }} aria-hidden="true" />
              <span className="sr-only">Locked</span>
            </td>
          ))}
        </tr>
      ))}
    </PriceTableFrame>
  );
}

/**
 * Masked preview of the live report's shape while locked (WYBY-02 §9) — same
 * section headers as the real, paid blocks below, every real number replaced
 * by a fixed, data-independent placeholder. Demonstrates that unlocking buys
 * an entire pricing analysis, not one table. `hasRecommendation` is the only
 * real signal passed in, and it's already an approved aggregate (the Paywall
 * above states as much in prose) — nothing here can leak an amount, a rate,
 * or a score.
 */
function LockedRecommendationPreview({ hasRecommendation }) {
  return (
    <div className="card p-6 bg-locked">
      <p className="pill bg-white">{hasRecommendation ? 'Current recommendation' : 'Still collecting'}</p>
      <p className="mt-3 text-5xl font-extrabold tracking-tight">{hasRecommendation ? '••• / month' : '—'}</p>
      <p className="mt-3 text-muted leading-relaxed">
        {hasRecommendation
          ? 'Unlock to see which tested price this is, its purchase intent, and its modelled revenue.'
          : 'Your test hasn’t collected enough data yet to name one — unlocking keeps the live report open as it does.'}
      </p>
    </div>
  );
}

function LockedIntentPreview() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">How serious were the yeses?</h2>
      <p className="hint mt-1">A yes costs nothing. This is the column that matters.</p>
      <div className="mt-5 rounded-xl border-2 border-ink p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Strong purchase intent</p>
        <p className="text-3xl font-extrabold tracking-tight">••%</p>
      </div>
    </div>
  );
}

function LockedSuggestedPricePreview() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">What the no-sayers would pay</h2>
      <div className="mt-4 rounded-xl border-2 border-ink p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Median suggested price</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight">••</p>
      </div>
    </div>
  );
}

function LockedPricingConfidencePreview() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">Pricing confidence</h2>
      <div className="mt-4 flex items-baseline gap-2">
        <p className="text-5xl font-extrabold tracking-tight">••</p>
        <p className="text-muted">/ 100</p>
      </div>
    </div>
  );
}

/** Assembles the full masked preview — the one thing the locked page renders
 * in place of the real report body. Order mirrors the real (paid) report so
 * unlocking feels like the placeholders simply resolving into numbers. */
export function LockedReportPreview({ variants, test, hasRecommendation }) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-bold uppercase tracking-wider text-muted">
        Preview of your updated live report
      </p>
      <LockedRecommendationPreview hasRecommendation={hasRecommendation} />
      <LockedPriceTable variants={variants} test={test} />
      <LockedIntentPreview />
      <LockedSuggestedPricePreview />
      <LockedPricingConfidencePreview />
    </div>
  );
}

/**
 * Pre-lock progress toward the free response limit — 1 response through
 * exactly `freeLimit`. Framed as a milestone the creator is building toward,
 * never as a countdown to a shutdown: the test keeps collecting past the
 * limit regardless, only the report gates on payment (see the Paywall for
 * that state, once past `freeLimit`). Caller is responsible for only
 * rendering this for unpaid tests at or under the limit.
 */
export function FreeProgressBanner({ responseCount, freeLimit }) {
  const remaining = Math.max(0, freeLimit - responseCount);
  const complete = responseCount >= freeLimit;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-bold">
          {complete ? `Free snapshot complete · ${freeLimit} responses` : `${responseCount} of ${freeLimit} free responses collected`}
        </p>
        {!complete && (
          <p className="hint">
            {remaining} free {remaining === 1 ? 'response' : 'responses'} remaining · Your test keeps collecting
            after {freeLimit}
          </p>
        )}
      </div>
      {complete && (
        <p className="hint mt-1">
          Your test can keep collecting responses. Updated analysis after the free sample is included when you
          unlock this test.
        </p>
      )}
      <div className="mt-2.5">
        <ConfidenceMeter value={Math.min(responseCount, freeLimit)} max={freeLimit} color="var(--color-accent)" />
      </div>
    </div>
  );
}

/**
 * The report's single recommendation hero (WYBY-03 §2-6). One block, not two
 * — this used to be a standalone "Charge X — highest modelled revenue..."
 * line in page.js PLUS this card repeating the same fact, which read as the
 * same sentence twice. `isPaid` only changes the copy for the not-enough-data
 * branch (WYBY-01 vs WYBY-03 §13); the enough-data branch is identical
 * whether the test is still in its free window or already paid, since it's
 * the same underlying claim either way.
 */
export function RecommendationCard({ recommendation, test, isPaid = false, pricingConfidence = null }) {
  const { enoughData, winner, isClearWinner, needed, totalResponses } = recommendation;

  if (!enoughData) {
    // Framed as "still building" rather than a refusal — the underlying rule
    // (no winner below the total+per-variant thresholds) doesn't change, only
    // how it reads. No "{N} more to go" figure here on purpose: with more than
    // one price variant, clearing the total threshold doesn't guarantee every
    // variant has cleared its own, so a single "more responses" count could
    // hit zero while the recommendation is still withheld — exactly the kind
    // of confident-but-wrong number this card exists to avoid.
    return (
      <div className="card p-6 bg-locked">
        <p className="pill bg-white">{isPaid ? 'Full report' : 'Building your sample'}</p>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">Keep collecting before choosing a price.</h2>
        <p className="mt-2 text-muted text-sm leading-relaxed">
          {isPaid ? (
            <>
              Your full live report is unlocked. We&apos;ll name a best-performing tested price once the sample is
              strong enough — you have <strong>{totalResponses}</strong> {totalResponses === 1 ? 'response' : 'responses'} so
              far.
            </>
          ) : (
            <>
              You have <strong>{totalResponses}</strong> {totalResponses === 1 ? 'response' : 'responses'}. We&apos;ll
              wait until the sample is strong enough before naming a best-performing price — that&apos;s more
              useful than a confident number that turns out to be wrong.
            </>
          )}
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          We need at least <strong>{needed.total} responses overall</strong> and{' '}
          <strong>{needed.perVariant} at each tested price</strong> before we&apos;ll name a recommendation.
        </p>
        {isPaid && (
          <p className="mt-3 text-sm font-semibold text-accent">
            This test stays unlocked either way — every new response updates this report automatically, and CSV
            export is already available.
          </p>
        )}
      </div>
    );
  }

  const tier = pricingConfidence && CONFIDENCE_TIERS.find((t) => pricingConfidence.score >= t.min);

  return (
    <div className="card p-6">
      <p className={`pill ${isClearWinner ? 'bg-accent text-white border-accent' : 'bg-white'}`}>
        {isClearWinner ? 'Current recommendation' : 'Prices are close'}
      </p>
      <p className="mt-3 text-5xl font-extrabold tracking-tight">
        {formatPrice(winner.amount, test.currency, test.billing_type)}
      </p>
      <p className="mt-1 font-bold">
        {isClearWinner
          ? `Best-performing tested price across ${totalResponses} responses`
          : 'Treat these prices as effectively tied for now.'}
      </p>
      <p className="mt-3 text-muted leading-relaxed">
        {pct(winner.yesRate)} said yes at this price, {isClearWinner ? 'producing' : 'giving'} the highest
        modelled revenue of the prices you tested ({money(winner.modelledRevenue, test.currency)} per 1,000
        visitors).
      </p>
      {isClearWinner ? (
        <p className="mt-3 text-sm font-semibold text-ok">
          Clear lead — this price is currently ahead of the other tested prices on modelled revenue.
        </p>
      ) : (
        <p className="mt-3 text-sm font-semibold text-accent">
          The runner-up is within 5% of this on modelled revenue — too close to call decisive. Treat this as a
          directional reference and pick on other grounds — positioning, margin, or what you can defend.
        </p>
      )}
      {tier && (
        <p className="mt-4 hint">
          Pricing confidence: <strong className="text-ink">{pricingConfidence.score}/100</strong> ·{' '}
          {tier.shortLabel}
        </p>
      )}
    </div>
  );
}

export function ConfidenceBlock({ confidence }) {
  const rows = [
    { label: 'Maybe', hint: 'Sounds interesting', value: confidence.maybe, rate: confidence.maybeRate },
    { label: 'Probably', hint: 'Would seriously consider', value: confidence.probably, rate: confidence.probablyRate },
    { label: "I'd actually pay", hint: 'Strong purchase intent', value: confidence.wouldPay, rate: confidence.strongRate },
  ];

  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">How serious were the yeses?</h2>
      <p className="hint mt-1">A yes costs nothing. This is the column that matters.</p>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-sm">
              <span className="font-bold">
                {row.label} <span className="hint font-normal">— {row.hint}</span>
              </span>
              <span className="tabular-nums font-bold">
                {row.value} ({pct(row.rate)})
              </span>
            </div>
            <div className="mt-1.5">
              <ConfidenceMeter value={row.rate} max={100} color="var(--color-accent)" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border-2 border-ink p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Strong purchase intent</p>
        <p className="text-3xl font-extrabold tracking-tight">{pct(confidence.strongRate)}</p>
        <p className="hint mt-1">Share of everyone asked who said yes and selected &ldquo;I&apos;d actually pay.&rdquo;</p>
      </div>
    </div>
  );
}

export function SuggestedPriceBlock({ suggested, test }) {
  if (!suggested.count) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight">What the no-sayers would pay</h2>
        <p className="hint mt-2">Nobody has suggested a price yet.</p>
      </div>
    );
  }

  const fmt = (value) => formatPrice(Math.round(value * 100) / 100, test.currency, 'one_time');

  // Lowest/average/highest used to be three bare text columns — no visual
  // separation from the median or from each other, and easy to skim past.
  // Boxing them (same motif as the median card, one weight down) makes each
  // number read as its own fact instead of a caption.
  const rangeStats = [
    { label: 'Lowest', value: suggested.min },
    { label: 'Average', value: suggested.average },
    { label: 'Highest', value: suggested.max },
  ];

  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">What the no-sayers would pay</h2>
      <p className="hint mt-1">
        From {suggested.count} {suggested.count === 1 ? 'person' : 'people'} who said no and named a price.
      </p>

      <div className="mt-4 rounded-xl border-2 border-ink p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Median suggested price</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight">{fmt(suggested.median)}</p>
        {suggested.count >= 4 && (
          <p className="hint mt-1">
            Half of the suggestions fall between {fmt(suggested.p25)} and {fmt(suggested.p75)}.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {rangeStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-paper p-3 text-center">
            <p className="hint">{stat.label}</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">{fmt(stat.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** score/100 → good/warn/danger. Mirrors the thresholds `pricingConfidence()` in
 * lib/stats.js implies (>=70 solid, >=40 directional, below thin) — status colors
 * are reserved for this one severity signal, never reused on the four-part
 * breakdown below (those are a magnitude decomposition, not four statuses). */
const CONFIDENCE_TIERS = [
  { min: 70, key: 'good', pillClass: 'bg-ok text-white border-ok', fill: 'var(--color-ok)', label: 'Solid — act on this', shortLabel: 'Solid' },
  { min: 40, key: 'warn', pillClass: 'bg-sun text-ink border-sun', fill: 'var(--color-sun)', label: 'Directional — keep collecting', shortLabel: 'Directional' },
  { min: 0, key: 'danger', pillClass: 'bg-alert text-white border-alert', fill: 'var(--color-alert)', label: 'Too thin to act on', shortLabel: 'Too thin to act on' },
];

/** A same-ramp meter: fill is `color`, track is a lighter step of that same hue
 * (never a generic gray) so severity/emphasis reads across the whole bar, per
 * the meter spec — not just the filled portion. */
function ConfidenceMeter({ value, max, color, thick = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  // A non-zero score still needs a sliver of visible fill — 100% width maps to
  // 0px on a 0-width bar otherwise, reading as "no data" for e.g. 1/40.
  const width = value > 0 ? Math.max(pct, 3) : 0;
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${thick ? 'h-2.5' : 'h-1.5'}`}
      style={{ background: `color-mix(in oklab, ${color} ${thick ? 16 : 14}%, white)` }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

const CONFIDENCE_PARTS = [
  { key: 'sample', label: 'Sample size', max: 40 },
  { key: 'balance', label: 'Even split across prices', max: 15 },
  { key: 'intent', label: 'Strength of intent', max: 25 },
  { key: 'agreement', label: 'Suggested prices agree with a tested price', max: 20 },
];

export function PricingConfidenceBlock({ pricingConfidence }) {
  if (!pricingConfidence) return null;
  const { score, parts } = pricingConfidence;
  const tier = CONFIDENCE_TIERS.find((t) => score >= t.min);

  // A part with no key in `parts` was excluded by `pricingConfidence()`
  // because the creator turned that follow-up off for this test — not
  // because it scored 0. The breakdown has to mirror the calculation
  // exactly (WYBY follow-up fix): an excluded component gets a "not asked"
  // row here, never a bar and never a fake score.
  const visibleParts = CONFIDENCE_PARTS.filter((part) => parts[part.key] !== undefined);
  const hasExcludedParts = visibleParts.length < CONFIDENCE_PARTS.length;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Pricing confidence</h2>
        <span className={`pill ${tier.pillClass}`}>{tier.label}</span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="text-5xl font-extrabold tracking-tight">{score}</p>
        <p className="text-muted">/ 100</p>
      </div>
      <div className="mt-3">
        <ConfidenceMeter value={score} max={100} color={tier.fill} thick />
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <p className="hint">
          {hasExcludedParts
            ? 'Built from the questions this test actually asked, so you can see exactly why it says what it says:'
            : 'Built from four things, so you can see exactly why it says what it says:'}
        </p>
        <div className="mt-3 space-y-3.5">
          {CONFIDENCE_PARTS.map((part) => {
            const value = parts[part.key];
            const asked = value !== undefined;
            return (
              <div key={part.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p className={asked ? '' : 'text-muted'}>{part.label}</p>
                  {asked ? (
                    <p className="shrink-0 tabular-nums">
                      <strong>{value}</strong>
                      <span className="text-muted">/{part.max}</span>
                    </p>
                  ) : (
                    <p className="shrink-0 text-muted italic">Not asked for this test</p>
                  )}
                </div>
                {asked && (
                  <div className="mt-1.5">
                    <ConfidenceMeter value={value} max={part.max} color="var(--color-accent)" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasExcludedParts && (
          <p className="hint mt-4">Score based on the questions included in this test.</p>
        )}
      </div>
    </div>
  );
}
