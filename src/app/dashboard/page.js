import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { readMyTestTokens } from '../../lib/visitor.js';
import { listTestsForViewer } from '../../lib/tests.js';
import { currentUser } from '../../lib/session.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My tests', robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await currentUser();
  const tokens = await readMyTestTokens();
  const tests = await listTestsForViewer({ userId: user?.id ?? null, creatorTokens: tokens });

  return (
    <>
      <SiteHeader />
      <main className="wrap inner-page pb-16">
        <h1 className="text-3xl font-extrabold tracking-tight">My tests</h1>
        <p className="hint mt-1">
          {user ? (
            'Saved to your account — visible from any device you log into.'
          ) : (
            <>
              Remembered by this browser. Your results links are the real keys — keep them bookmarked, or{' '}
              <Link href="/login" className="underline">
                log in
              </Link>{' '}
              to keep this list for good.
            </>
          )}
        </p>

        {tests.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Tests', value: tests.length },
              { label: 'Active', value: tests.filter((t) => t.status === 'active').length },
              { label: 'Responses', value: tests.reduce((sum, t) => sum + t.response_count, 0) },
              {
                label: 'Unlocked',
                value: `${tests.filter((t) => t.is_paid).length} of ${tests.length}`,
              },
            ].map((tile) => (
              <div key={tile.label} className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{tile.label}</p>
                <p className="text-2xl font-extrabold">{tile.value}</p>
              </div>
            ))}
          </div>
        )}

        {tests.length === 0 ? (
          <div className="card mt-7 p-6 text-center">
            <p className="text-xl font-extrabold tracking-tight">Nothing here yet.</p>
            <p className="mt-2 text-muted">
              {user
                ? 'Tests you create show up here automatically.'
                : 'Tests you create in this browser show up here. If you created one elsewhere, open its results link directly.'}
            </p>
            <Link href="/create" className="btn btn-primary mt-5 w-full sm:w-auto">
              Create a price test
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-7 space-y-4">
              {tests.map((test) => (
                <Link key={test.id} href={`/r/${test.creator_token}`} className="card block p-5 hover:bg-locked">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight">{test.title}</p>
                      <p className="hint mt-1">
                        {test.response_count} {test.response_count === 1 ? 'response' : 'responses'} ·{' '}
                        {test.variant_count} {test.variant_count === 1 ? 'price' : 'prices'} ·{' '}
                        {test.currency}
                      </p>
                    </div>
                    <span
                      className={`pill shrink-0 ${
                        test.status === 'active' ? 'bg-ok text-white border-ok' : 'bg-locked'
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/create" className="btn btn-primary mt-7 w-full sm:w-auto">
              Create another test
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
