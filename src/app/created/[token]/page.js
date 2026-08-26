import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTestByCreatorToken, getPriceVariants } from '../../../lib/tests.js';
import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { ShareBox } from './ShareBox.js';
import { ResultsLinkActions } from './ResultsLinkActions.js';
import { config, formatPrice } from '../../../lib/config.js';
import { currentUser } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your test is ready', robots: { index: false, follow: false } };

export default async function CreatedPage({ params }) {
  const { token } = await params;
  const test = await getTestByCreatorToken(token);
  if (!test) notFound();

  const variants = await getPriceVariants(test.id);
  const shareUrl = `${config.appUrl}/t/${test.slug}`;
  const resultsPath = `/r/${test.creator_token}`;
  const resultsUrl = `${config.appUrl}${resultsPath}`;
  const user = await currentUser();
  const isSavedToAccount = user?.id === test.user_id;

  return (
    <>
      <SiteHeader />
      <main className="wrap inner-page pb-16">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Your test is ready</h1>
        <p className="mt-2 text-muted">
          Now send it to people who might actually buy <strong>{test.title}</strong>. Ten honest answers
          beat a hundred guesses.
        </p>

        <div className="mt-7 space-y-5">
          <ShareBox shareUrl={shareUrl} title={test.title} />

          <div className="card p-6">
            <p className="label">Prices being tested</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => (
                <span key={variant.id} className="pill bg-white py-2 text-sm">
                  {formatPrice(variant.amount, test.currency, test.billing_type)}
                </span>
              ))}
            </div>
            <p className="hint mt-3">
              Each person sees one of these at random, and never learns there were others.
            </p>
          </div>

          <div className="card p-6 bg-locked">
            <p className="font-extrabold">{isSavedToAccount ? 'Saved to your account' : '⚠️ Save your results link'}</p>
            <p className="mt-1 text-sm text-muted">
              {isSavedToAccount
                ? 'You can find this test in My tests. Keep this private results link for direct access — anyone with it can see your results.'
                : 'This private link is the only guaranteed way to recover your results. Anyone with it can see them, so bookmark or copy it somewhere safe.'}
            </p>
            <ResultsLinkActions resultsUrl={resultsUrl} />
            <Link href={resultsPath} className="btn btn-plain mt-3 w-full sm:ml-3 sm:w-auto">
              Open results
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
