import { notFound } from 'next/navigation';
import Link from 'next/link';
import { OfferCard } from '../../../components/OfferCard.js';
import { SiteFooter } from '../../../components/SiteChrome.js';
import { RespondFlow } from './RespondFlow.js';
import { getTestBySlug, assignPriceVariant, getExistingResponse } from '../../../lib/tests.js';
import { readVisitorId } from '../../../lib/visitor.js';
import { track } from '../../../lib/events.js';
import { currencySymbol, formatPrice } from '../../../lib/config.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const test = await getTestBySlug(slug);
  if (!test) return { title: 'Test not found — Would You Buy It?' };

  // The price is deliberately absent from the share preview: a link pasted into
  // a group chat must not reveal which price the next person will be shown.
  return {
    title: `Would you buy ${test.title}?`,
    description: test.description,
    openGraph: {
      title: `Would you buy ${test.title}?`,
      description: test.description,
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: false, follow: false },
  };
}

function ClosedNotice({ title }) {
  return (
    <main className="wrap py-20 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
        This test is no longer accepting responses.
      </h1>
      <p className="mt-2 text-muted">{title}</p>
      <Link href="/create" className="btn btn-primary mt-7">
        Test your own product
      </Link>
    </main>
  );
}

export default async function RespondentPage({ params }) {
  const { slug } = await params;
  const test = await getTestBySlug(slug);
  if (!test) notFound();

  if (test.status !== 'active') {
    return (
      <>
        <ClosedNotice title={test.title} />
        <SiteFooter variant="minimal" />
      </>
    );
  }

  const visitorId = await readVisitorId();
  const variant = await assignPriceVariant(test.id, visitorId);
  const existing = visitorId ? await getExistingResponse(test.id, visitorId) : null;

  await track('respondent_view', { testId: test.id, visitorId });

  return (
    <>
      <main className="wrap py-8 sm:py-14">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Would you buy {test.title}?
          </h1>
        </div>
        <OfferCard test={test} price={variant.amount}>
          {existing ? (
            <div className="card mt-6 p-6 text-center">
              <p className="text-xl font-extrabold tracking-tight">You already answered this one.</p>
              <p className="mt-2 text-muted">
                You said <strong>{existing.answer === 'yes' ? 'yes' : 'nope'}</strong> at{' '}
                {formatPrice(existing.amount, test.currency, test.billing_type)}. One vote per person keeps
                the numbers honest.
              </p>
              <Link href={`/create?ref=${encodeURIComponent(test.slug)}`} className="btn btn-primary mt-5 w-full sm:w-auto">
                Test your own product
              </Link>
            </div>
          ) : (
            <RespondFlow
              slug={test.slug}
              currencySymbol={currencySymbol(test.currency)}
              askConfidence={test.ask_confidence}
              askSuggestedPrice={test.ask_suggested_price}
            />
          )}
        </OfferCard>

        <p className="hint mt-8 text-center">
          One response per person keeps the numbers honest.{' '}
          <Link href={`/report/${test.slug}`} className="underline">
            Report this test
          </Link>
        </p>
      </main>
      <SiteFooter variant="minimal" />
    </>
  );
}
