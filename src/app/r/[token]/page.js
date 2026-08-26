import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import {
  StatTile,
  PriceTable,
  RecommendationCard,
  ConfidenceBlock,
  SuggestedPriceBlock,
  PricingConfidenceBlock,
} from '../../../components/ResultsBlocks.js';
import { ResultsActions } from './ResultsActions.js';
import { getTestByCreatorToken, getPriceVariants, getResponses, isReportLocked } from '../../../lib/tests.js';
import { buildReport } from '../../../lib/stats.js';
import { track } from '../../../lib/events.js';
import { config } from '../../../lib/config.js';
import { UnlockButton } from './UnlockButton.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your results', robots: { index: false, follow: false } };

const pct = (value) => `${value.toFixed(value >= 10 ? 0 : 1)}%`;

function Paywall({ responseCount, recommendation, token }) {
  // Never promise a winning price we cannot actually compute yet — paying and
  // landing on "not enough data" is how you earn a refund request.
  const supportingCopy = !recommendation.enoughData
    ? `Your responses are already collected. Unlock the full analysis to see how each price performed. Keep collecting before we name a best-performing price.`
    : 'Your responses are already collected. Unlock the full analysis to see how each price performed and which price gives you the strongest result.';
  const detail = !recommendation.enoughData
    ? `Not enough yet to name a best-performing price — ${recommendation.needed.moreTotal} more responses will do it.`
    : recommendation.isClearWinner
      ? 'One of your prices is clearly ahead of the others.'
      : 'Your prices are running close together, which is exactly when the detail matters.';

  return (
    <div className="card p-6 bg-locked">
      <p className="pill bg-white">Locked</p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
        Unlock your full pricing report — $14.90
      </h2>
      <p className="mt-2 text-muted leading-relaxed">
        {supportingCopy}
      </p>
      <p className="hint mt-2">
        You collected {responseCount} responses. {detail} The free tier covers the first {config.freeResponseLimit}{' '}
        responses — your test is past that and still collecting.
      </p>

      <ul className="mt-4 space-y-1 text-sm">
        <li>✓ Purchase intent at every price</li>
        <li>✓ Modelled revenue per price</li>
        <li>✓ Median suggested price</li>
        <li>✓ Strong purchase-intent breakdown</li>
        {recommendation.enoughData && <li>✓ Best-performing tested price</li>}
        <li>✓ CSV export</li>
      </ul>

      <UnlockButton token={token} stripeEnabled={config.stripe.enabled} price="$14.90" />
    </div>
  );
}

export default async function ResultsPage({ params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) notFound();

  const [variants, responses] = await Promise.all([getPriceVariants(test.id), getResponses(test.id)]);
  const report = buildReport(variants, responses);
  const locked = isReportLocked(test, responses.length);

  await track('results_viewed', { testId: test.id });
  if (locked) await track('paywall_viewed', { testId: test.id, props: { responses: responses.length } });

  const shareUrl = `${config.appUrl}/t/${test.slug}`;
  const remaining = Math.max(0, test.free_response_limit - responses.length);

  return (
    <>
      <SiteHeader />
      <main className="wrap inner-page pb-16 space-y-5">
        <div>
          <div className="flex items-center gap-2 pt-2">
            <span className={`pill ${test.status === 'active' ? 'bg-ok text-white border-ok' : 'bg-locked'}`}>
              {test.status}
            </span>
            {test.is_paid && <span className="pill bg-white">Full report</span>}
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">{test.title}</h1>
          <p className="mt-2 text-muted">Your purchase-intent results, in one place.</p>
          <Link href={`/t/${test.slug}`} className="hint underline" target="_blank">
            View the page respondents see
          </Link>
        </div>

        {responses.length === 0 ? (
          <div className="card p-6">
            <h2 className="text-xl font-extrabold tracking-tight">No responses yet.</h2>
            <p className="mt-2 text-muted leading-relaxed">
              Nothing happens until you send the link. Ten people from your own network will tell you
              more than a hundred strangers.
            </p>
            <Link href={`/created/${test.creator_token}`} className="btn btn-primary mt-5 w-full sm:w-auto">
              Get sharing options
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Responses" value={responses.length} />
              <StatTile label="Overall purchase intent" value={pct(report.confidence.yesRate)} />
              <StatTile
                label="Strong purchase intent"
                value={pct(report.confidence.strongRate)}
                sub="The honest number"
              />
            </div>

            {!locked && remaining > 0 && (
              <p className="hint text-center">
                Free up to {test.free_response_limit} responses — {remaining} to go before the detailed
                report locks.
              </p>
            )}

            {locked ? (
              <>
                <Paywall
                  responseCount={responses.length}
                  recommendation={report.recommendation}
                  token={test.creator_token}
                />
                <div className="locked-blur" aria-hidden="true">
                  <PriceTable priceStats={report.priceStats} test={test} winnerId={null} />
                </div>
              </>
            ) : (
              <>
                <RecommendationCard recommendation={report.recommendation} test={test} />
                <PriceTable
                  priceStats={report.priceStats}
                  test={test}
                  winnerId={report.recommendation.enoughData ? report.recommendation.winner?.id : null}
                />
                {test.ask_confidence && <ConfidenceBlock confidence={report.confidence} />}
                {test.ask_suggested_price && <SuggestedPriceBlock suggested={report.suggested} test={test} />}
                <PricingConfidenceBlock pricingConfidence={report.pricingConfidence} />
              </>
            )}
          </>
        )}

        <ResultsActions token={test.creator_token} shareUrl={shareUrl} status={test.status} locked={locked} />
      </main>
      <SiteFooter />
    </>
  );
}
