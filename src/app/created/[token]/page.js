import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTestByCreatorToken, getPriceVariants } from '../../../lib/tests.js';
import { SiteHeader, SiteFooter } from '../../../components/SiteChrome.js';
import { ShareBox } from '../../../components/ShareBox.js';
import { ResultsLinkActions } from './ResultsLinkActions.js';
import { config, formatPrice } from '../../../lib/config.js';
import { currentUser } from '../../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your test is live', robots: { index: false, follow: false } };

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
  // `?claimed=1` is what ClaimToast on /r/[token] keys off, once the existing
  // OAuth/magic-link `next=` flow lands the creator back here after signup.
  const signupNext = encodeURIComponent(`${resultsPath}?claimed=1`);

  return (
    <>
      <SiteHeader />
      <main className="wrap inner-page pb-16">
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">🎉 Your test is live</h1>
        <p className="mt-2 text-muted">
          Send it to people who might actually buy <strong>{test.title}</strong>. Ten honest answers beat a
          hundred guesses.
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

          {isSavedToAccount ? (
            <div className="card p-6 bg-locked">
              <p className="font-extrabold">Saved to your account</p>
              <p className="mt-1 text-sm text-muted">You can find this test in My tests any time.</p>
              <Link href={resultsPath} className="btn btn-primary mt-4 w-full sm:w-auto">
                Manage test
              </Link>
            </div>
          ) : (
            <div className="card p-6 bg-locked">
              <p className="font-extrabold">Keep access to your test</p>
              <p className="mt-1 text-sm text-muted">
                Create a free account to access this test from any device and keep all your tests in one
                place.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={`/login?mode=signup&next=${signupNext}`} className="btn btn-primary w-full sm:w-auto">
                  Create free account
                </Link>
                <Link href={resultsPath} className="btn btn-plain w-full sm:w-auto">
                  Manage test
                </Link>
              </div>
              <ResultsLinkActions resultsUrl={resultsUrl} />
              <p className="hint mt-3">
                Anyone with the private link can manage this test. Keep it somewhere safe.
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
