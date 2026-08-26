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

/**
 * Per-price results. The bar is the yes-rate; the modelled-revenue column is
 * what actually decides the winner, so it gets its own visual weight.
 */
export function PriceTable({ priceStats, test, winnerId }) {
  const maxRate = Math.max(...priceStats.map((p) => p.yesRate), 1);

  return (
    <div className="card overflow-hidden">
      {/* Scrolls rather than clips: at 390px the five columns do not fit, and
        * `overflow-hidden` alone put modelled revenue — the headline number of
        * the paid report — permanently off-screen on a phone. */}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="border-b-2 border-ink bg-locked text-left">
            <th className="p-3 font-bold">Price</th>
            <th className="p-3 font-bold text-right">Asked</th>
            <th className="p-3 font-bold text-right">Yes</th>
            <th className="p-3 font-bold text-right">Yes rate</th>
            <th className="p-3 font-bold text-right">Modelled revenue</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
      </div>
      <p className="hint p-3 border-t-2 border-ink bg-locked">
        <strong>Modelled revenue</strong> estimates the relative revenue potential of each tested price based on
        respondents&apos; answers. It compares prices, not actual revenue.
      </p>
    </div>
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

export function PricingConfidenceBlock({ pricingConfidence }) {
  if (!pricingConfidence) return null;
  const { score, parts } = pricingConfidence;

  const verdict =
    score >= 70 ? 'Solid — you can act on this.' : score >= 40 ? 'Directional. Keep collecting.' : 'Too thin to act on.';

  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">Pricing confidence</h2>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-4xl font-extrabold tracking-tight">{score}</p>
        <p className="text-muted">/ 100 — {verdict}</p>
      </div>
      <p className="hint mt-3">Built from four things, so you can see exactly why it says what it says:</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>Sample size — <strong>{parts.sample}</strong>/40</li>
        <li>Even split across prices — <strong>{parts.balance}</strong>/15</li>
        <li>Strength of intent — <strong>{parts.intent}</strong>/25</li>
        <li>Suggested prices agree with a tested price — <strong>{parts.agreement}</strong>/20</li>
      </ul>
    </div>
  );
}
