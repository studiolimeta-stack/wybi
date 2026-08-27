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
function PriceTableFrame({ caption, children }) {
  return (
    <div className="card overflow-hidden">
      {/* Scrolls rather than clips: at 390px the five columns do not fit, and
        * `overflow-hidden` alone put modelled revenue — the headline number of
        * the paid report — permanently off-screen on a phone. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b-2 border-ink bg-locked text-left">
              {PRICE_COLUMNS.map((label, index) => (
                <th key={label} className={`p-3 font-bold${index === 0 ? '' : ' text-right'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <p className="hint p-3 border-t-2 border-ink bg-locked">
        <strong>Modelled revenue</strong> estimates the relative revenue potential of each tested price based on
        respondents&apos; answers. It compares prices, not actual revenue.
      </p>
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
    <PriceTableFrame>
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
              <span className="h-2 rounded-full bg-yes" style={{ width: `${(row.yesRate / maxRate) * 56}px` }} />
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

export function RecommendationCard({ recommendation, test }) {
  const { enoughData, winner, isClearWinner, needed, totalResponses } = recommendation;

  if (!enoughData) {
    return (
      <div className="card p-6 bg-locked">
        <p className="pill bg-white">Not enough data yet</p>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">
          We won&apos;t name a best-performing price yet.
        </h2>
        <p className="mt-2 text-muted text-sm leading-relaxed">
          You have <strong>{totalResponses}</strong> {totalResponses === 1 ? 'response' : 'responses'}.
          Below {needed.total} total — and {needed.perVariant} per price — the differences between your
          prices are statistical noise, and we would rather tell you that than sell you a confident
          number that is wrong.
        </p>
        {needed.moreTotal > 0 && (
          <p className="mt-3 font-bold">
            {needed.moreTotal} more {needed.moreTotal === 1 ? 'response' : 'responses'} to go.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <p className="pill bg-locked">Best-performing tested price</p>
      <p className="mt-3 text-5xl font-extrabold tracking-tight">
        {formatPrice(winner.amount, test.currency, test.billing_type)}
      </p>
      <p className="mt-3 text-muted leading-relaxed">
        {pct(winner.yesRate)} said yes at this price, giving the highest modelled revenue of everything
        you tested ({money(winner.modelledRevenue, test.currency)} per 1,000 visitors).
      </p>
      {!isClearWinner && (
        <p className="mt-3 text-sm font-semibold text-accent">
          Heads up: the runner-up is within 5% of this. Treat them as tied and pick on other grounds —
          positioning, margin, or what you can defend.
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
            <div className="mt-1 h-2 rounded-full bg-locked">
              <div
                className="h-2 rounded-full bg-ink"
                style={{ width: `${Math.min(100, row.rate)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border-2 border-ink bg-locked p-4">
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

  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">What the no-sayers would pay</h2>
      <p className="hint mt-1">
        From {suggested.count} {suggested.count === 1 ? 'person' : 'people'} who said no and named a price.
      </p>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Median suggested price</p>
      <p className="text-4xl font-extrabold tracking-tight">{fmt(suggested.median)}</p>

      {suggested.count >= 4 && (
        <p className="mt-2 text-sm text-muted">
          Half of the suggestions fall between {fmt(suggested.p25)} and {fmt(suggested.p75)}.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="hint">Lowest</p>
          <p className="font-bold">{fmt(suggested.min)}</p>
        </div>
        <div>
          <p className="hint">Average</p>
          <p className="font-bold">{fmt(suggested.average)}</p>
        </div>
        <div>
          <p className="hint">Highest</p>
          <p className="font-bold">{fmt(suggested.max)}</p>
        </div>
      </div>
    </div>
  );
}

/** score/100 → good/warn/danger. Mirrors the thresholds `pricingConfidence()` in
 * lib/stats.js implies (>=70 solid, >=40 directional, below thin) — status colors
 * are reserved for this one severity signal, never reused on the four-part
 * breakdown below (those are a magnitude decomposition, not four statuses). */
const CONFIDENCE_TIERS = [
  { min: 70, key: 'good', pillClass: 'bg-ok text-white border-ok', fill: 'var(--color-ok)', label: 'Solid — act on this' },
  { min: 40, key: 'warn', pillClass: 'bg-sun text-ink border-sun', fill: 'var(--color-sun)', label: 'Directional — keep collecting' },
  { min: 0, key: 'danger', pillClass: 'bg-alert text-white border-alert', fill: 'var(--color-alert)', label: 'Too thin to act on' },
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
        <p className="hint">Built from four things, so you can see exactly why it says what it says:</p>
        <div className="mt-3 space-y-3.5">
          {CONFIDENCE_PARTS.map((part) => (
            <div key={part.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <p>{part.label}</p>
                <p className="shrink-0 tabular-nums">
                  <strong>{parts[part.key]}</strong>
                  <span className="text-muted">/{part.max}</span>
                </p>
              </div>
              <div className="mt-1.5">
                <ConfidenceMeter value={parts[part.key]} max={part.max} color="var(--color-accent)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
