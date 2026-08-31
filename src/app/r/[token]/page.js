import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { CheckIcon } from '../../../components/CheckIcon.js';
import {
  StatTile,
  PriceTable,
  LockedReportPreview,
  RecommendationCard,
  ConfidenceBlock,
  SuggestedPriceBlock,
  PricingConfidenceBlock,
  FreeProgressBanner,
  ObjectionBlock,
  PricingStrategyBlock,
} from '../../../components/ResultsBlocks.js';
import { ManageTestMenu } from './ManageTestMenu.js';
import { ShareTestButton } from './ShareTestButton.js';
import { getTestByCreatorToken, getPriceVariants, getResponses, isReportLocked } from '../../../lib/tests.js';
import { buildReport, computeAnswerRate, compareRecommendations } from '../../../lib/stats.js';
import { track, getTestViewCount } from '../../../lib/events.js';
import { config } from '../../../lib/config.js';
import { currentUser } from '../../../lib/session.js';
import { UnlockButton } from './UnlockButton.js';
import { UnlockToast } from './UnlockToast.js';
import { ClaimToast } from './ClaimToast.js';
import { ClaimTestPrompt } from './ClaimTestPrompt.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your results', robots: { index: false, follow: false } };

const pct = (value) => `${value.toFixed(value >= 10 ? 0 : 1)}%`;

/** Every truthful, dynamic sales signal the locked page can lead with (WYBY-02
 * §5) — keyed by what `compareRecommendations` returns. Each one only claims
 * what the current data actually supports; never "changed" unless it did,
 * never a decisive winner when prices are still close. */
const CONVERSION_COPY = {
  leader_changed: {
    headline: 'Your latest responses changed the leading price.',
    body: 'Unlock the updated report to see what is leading now and why.',
  },
  leader_holding: {
    headline: 'Your leading price is holding up as more responses come in.',
    body: 'See how the additional responses changed the gap, purchase intent, modelled revenue, and confidence in the result.',
  },
  now_has_leader: {
    headline: 'Your test now has enough data to compare your prices.',
    body: 'One tested price is currently clearly ahead.',
  },
  now_close: {
    headline: 'Your latest results are close.',
    body: 'Unlock the report to see how the prices compare and why we would treat the result as directional rather than decisive.',
  },
  still_building: {
    headline: 'Your test is still building a reliable sample.',
    body: 'Unlock this test once to keep the live report open as new responses come in.',
  },
};

/**
 * The main revenue-conversion screen (WYBY-02). Sells the CURRENT, updated
 * report — not "give us $14.90 to get back what we took away" — so every
 * number here is framed around what changed since the free snapshot, never
 * around what's being withheld.
 */
function Paywall({ test, totalResponses, newResponses, recommendation, freeRecommendation, token, customerEmail }) {
  const state = compareRecommendations(freeRecommendation, recommendation);
  const { headline: stateHeadline, body: stateBody } = CONVERSION_COPY[state];

  // Never promise a block this test can't actually produce: the objection
  // split is built from suggested prices, so a test with that follow-up
  // switched off would unlock to a bullet that renders nothing.
  const benefits = [
    ...(recommendation.enoughData ? ['Latest best-performing tested price'] : []),
    'Purchase intent + modelled revenue at every price',
    'Revenue-max vs reach-max price, side by side',
    ...(test.ask_suggested_price ? ['Which no’s are winnable on price — and which aren’t'] : []),
    'Strong-intent and suggested-price analysis',
    'Pricing Confidence + CSV export',
  ];

  return (
    <div className="card p-6 bg-locked">
      <p className="pill bg-white">Updated report ready</p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
        {newResponses} new {newResponses === 1 ? 'response is' : 'responses are'} waiting
      </h2>
      <p className="mt-2 text-muted leading-relaxed">
        Your free report was based on the first {test.free_response_limit} responses. Your test now has{' '}
        {totalResponses}. Unlock the updated pricing analysis to see what all of your latest data says.
      </p>

      <div className="mt-4 rounded-xl border-2 border-ink bg-white p-4">
        <p className="font-bold">{stateHeadline}</p>
        <p className="hint mt-1">{stateBody}</p>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {benefits.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <UnlockButton
        token={token}
        paddleEnabled={config.paddle.enabled}
        paddleClientToken={config.paddle.clientToken}
        paddleEnvironment={config.paddle.environment}
        paddlePriceId={config.paddle.unlockPriceId}
        customerEmail={customerEmail}
        price="$14.90"
        totalResponses={totalResponses}
      />
    </div>
  );
}

export default async function ResultsPage({ params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) notFound();

  const [variants, responses, viewCount] = await Promise.all([
    getPriceVariants(test.id),
    getResponses(test.id),
    getTestViewCount(test.id),
  ]);
  const report = buildReport(variants, responses, test);
  const locked = isReportLocked(test, responses.length);
  // Stable and deterministic without persisting anything: getResponses()
  // already returns rows ORDER BY created_at, and free_response_limit is
  // fixed on a test at creation time, so "the first N responses" is the same
  // slice forever — this can never silently drift as more responses arrive.
  const freeReport = locked
    ? buildReport(variants, responses.slice(0, test.free_response_limit), test)
    : null;
  // null unless the underlying view-tracking data can support an honest
  // percentage (see computeAnswerRate's own doc comment) — never rendered
  // when null, never gated by `locked`: this is traffic data, not part of
  // the paid pricing analysis.
  const answerRate = computeAnswerRate(viewCount, responses.length);
  // Responses + Overall purchase intent always show; Strong purchase intent
  // needs `ask_confidence` on (otherwise every confidence is null and the
  // tile would show a fake, real-looking 0%) and Answer rate needs
  // answer-rate data to exist (see computeAnswerRate) — so the tile count
  // ranges 2–4 and the grid's column count has to track it, or the grid
  // leaves an empty cell / stretches a lone tile full-width.
  const statTileCount = 2 + (test.ask_confidence ? 1 : 0) + (answerRate !== null ? 1 : 0);
  const statTileGridCols =
    statTileCount === 4 ? 'sm:grid-cols-4' : statTileCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  // Cross-device claiming (spec §15) — only ever offered when a real session
  // exists and the test is genuinely unclaimed. Never re-derives ownership
  // from the token alone; the token only ever proves creator access, not
  // account identity.
  const user = await currentUser();
  const showClaimPrompt = Boolean(user && test.user_id === null);

  await track('results_viewed', { testId: test.id });
  if (locked) await track('paywall_viewed', { testId: test.id, props: { responses: responses.length } });

  const shareUrl = `${config.appUrl}/t/${test.slug}`;

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16 space-y-5">
        <ClaimToast />
        {showClaimPrompt && <ClaimTestPrompt token={test.creator_token} />}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 pt-2">
              <span className={`pill ${test.status === 'active' ? 'bg-ok text-white border-ok' : 'bg-locked'}`}>
                {test.status}
              </span>
              {test.is_paid && <span className="pill bg-white">Full report</span>}
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">{test.title}</h1>
            <p className="mt-2 text-muted">Your purchase-intent results, in one place.</p>
            {/* Only for paid tests — "future responses included" is a benefit of having
              * actually unlocked the test, not something to imply while still free/locked. */}
            {test.is_paid && (
              <p className="hint mt-1">
                Updated with all {responses.length} {responses.length === 1 ? 'response' : 'responses'} · Future
                responses included
              </p>
            )}
          </div>

          {/* All three land here, next to the title, so they're usable the instant
            * you land on the page — not a link buried under the report, not a
            * "Manage" card at the very bottom you'd only see after scrolling past
            * everything.
            *
            * Wraps onto its own line(s) below `sm` rather than scrolling
            * horizontally, which is what this used to do. That approach
            * (`.scroll-hint-x`, a fade meant to hint more buttons sat
            * off-screen) is gone on purpose, not just for style: it faded a
            * white pill-button into a near-white page background (#FFFDF9
            * into #FFF8F0) with almost no contrast to fade across — a
            * masked-vs-unmasked screenshot diff measured the effect at
            * ~0.68% mean pixel difference, imperceptible at any mask
            * strength. The real-world result was "Manage this test" — and
            * the CSV export inside it — silently unreachable on a 390px
            * phone with zero visible cue that anything was off-screen.
            * Don't reintroduce a scroll+fade fix for this row without a
            * genuinely visible, color-independent affordance (e.g. a
            * chevron icon) to pair with it — a fade alone will not read as
            * discoverable against this palette no matter how it's tuned. */}
          <div className="flex w-full flex-wrap items-center gap-2 pt-2 pb-3 sm:w-auto sm:flex-nowrap sm:pt-0 sm:pb-0">
            <Link
              href={`/t/${test.slug}`}
              target="_blank"
              className="btn btn-plain shrink-0 px-3 py-2 text-sm sm:px-4"
            >
              View respondent page
            </Link>
            <ShareTestButton shareUrl={shareUrl} title={test.title} />
            <ManageTestMenu token={test.creator_token} status={test.status} locked={locked} />
          </div>
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
            <div className={`grid gap-3 ${statTileGridCols}`}>
              <StatTile label="Responses" value={responses.length} />
              <StatTile
                label="Overall purchase intent"
                value={pct(report.confidence.yesRate)}
                sub="The optimistic number"
              />
              {test.ask_confidence && (
                <StatTile
                  label="Strong purchase intent"
                  value={pct(report.confidence.strongRate)}
                  sub="The honest number"
                />
              )}
              {answerRate !== null && (
                <StatTile
                  label="Answer rate"
                  value={pct(answerRate)}
                  sub={`${responses.length} of ${viewCount} visitors`}
                />
              )}
            </div>

            {/* Only meaningful pre-payment, at or under the free limit — past it the
              * Paywall below takes over, and a paid test has no "free" concept left. */}
            {!test.is_paid && responses.length <= test.free_response_limit && (
              <FreeProgressBanner responseCount={responses.length} freeLimit={test.free_response_limit} />
            )}

            {locked ? (
              <>
                <Paywall
                  test={test}
                  totalResponses={responses.length}
                  newResponses={responses.length - test.free_response_limit}
                  recommendation={report.recommendation}
                  freeRecommendation={freeReport.recommendation}
                  token={test.creator_token}
                  customerEmail={user?.email ?? null}
                />
                {/* Never `report.priceStats` on this branch. A locked report is
                  * withheld server-side — the numbers must not reach the HTML at
                  * all, blurred or otherwise (see LockedReportPreview). */}
                <LockedReportPreview
                  variants={variants}
                  test={test}
                  hasRecommendation={report.recommendation.enoughData}
                />

                {/* The creator's own free analysis, preserved exactly as they saw it —
                  * this is real, already-shown data (not paid data), so it renders with
                  * the same unlocked components the paid path uses below. Collapsed by
                  * default (WYBY-02 §12's "if it distracts from conversion" fallback) —
                  * plain <details>/<summary> so this needs no client component and still
                  * works with JS disabled. */}
                <details className="group [&::-webkit-details-marker]:hidden">
                  {/* Styled as its own secondary section (bg-paper tint + real heading
                    * hierarchy), not a bare utility row — but deliberately never bg-locked
                    * or accent-heavy: this must read as clearly less prominent than the
                    * "33 new responses are waiting" card above and the repeated CTA below. */}
                  <summary className="card bg-paper cursor-pointer list-none p-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight">
                        Your free snapshot — first {test.free_response_limit} responses
                      </h2>
                      <p className="hint mt-1">
                        Frozen at {test.free_response_limit} responses ·{' '}
                        {responses.length - test.free_response_limit}{' '}
                        {responses.length - test.free_response_limit === 1
                          ? 'newer response is'
                          : 'newer responses are'}{' '}
                        not included
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-accent">
                      <span className="group-open:hidden">View free snapshot</span>
                      <span className="hidden group-open:inline">Hide snapshot</span>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                    </div>
                  </summary>
                  {/* No intro box/badge here on purpose — the accordion header above
                    * already says what this is; the content just starts with the report. */}
                  <div className="mt-3 space-y-3">
                    <RecommendationCard
                      recommendation={freeReport.recommendation}
                      test={test}
                      pricingConfidence={freeReport.pricingConfidence}
                    />
                    <PriceTable
                      priceStats={freeReport.priceStats}
                      test={test}
                      winnerId={freeReport.recommendation.enoughData ? freeReport.recommendation.winner?.id : null}
                    />
                    {test.ask_confidence && <ConfidenceBlock confidence={freeReport.confidence} />}
                    {test.ask_suggested_price && (
                      <SuggestedPriceBlock suggested={freeReport.suggested} test={test} />
                    )}
                    <PricingConfidenceBlock pricingConfidence={freeReport.pricingConfidence} />
                  </div>
                </details>

                <div className="card p-6 text-center">
                  <UnlockButton
                    token={test.creator_token}
                    paddleEnabled={config.paddle.enabled}
                    paddleClientToken={config.paddle.clientToken}
                    paddleEnvironment={config.paddle.environment}
                    paddlePriceId={config.paddle.unlockPriceId}
                    customerEmail={user?.email ?? null}
                    price="$14.90"
                    totalResponses={responses.length}
                  />
                </div>
              </>
            ) : (
              <>
                {test.is_paid && <UnlockToast />}
                <RecommendationCard
                  recommendation={report.recommendation}
                  test={test}
                  isPaid={test.is_paid}
                  pricingConfidence={report.pricingConfidence}
                />
                <PriceTable
                  priceStats={report.priceStats}
                  test={test}
                  winnerId={report.recommendation.enoughData ? report.recommendation.winner?.id : null}
                />
                {/* Paid-only extras. Gated on `test.is_paid`, NOT on this branch:
                  * reaching the else of `locked` only means "not locked", which is
                  * also true for a free test still under its free_response_limit.
                  * Gating these on the branch alone would hand them to every free
                  * report under the threshold — the exact opposite of the intent. */}
                {test.is_paid && (
                  <PricingStrategyBlock
                    strategies={report.strategies}
                    test={test}
                    enoughData={report.recommendation.enoughData}
                  />
                )}
                {test.ask_confidence && <ConfidenceBlock confidence={report.confidence} />}
                {test.ask_suggested_price && <SuggestedPriceBlock suggested={report.suggested} test={test} />}
                {test.is_paid && test.ask_suggested_price && (
                  <ObjectionBlock objections={report.objections} test={test} />
                )}
                <PricingConfidenceBlock pricingConfidence={report.pricingConfidence} />
              </>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
