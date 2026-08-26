import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { CreateForm } from './CreateForm.js';
import { TrackView } from '../../components/Track.js';

export const metadata = { title: 'Create a price test — Would You Buy It?' };

export default function CreatePage() {
  return (
    <>
      {/* The step between "saw the homepage" and "created a test" — the one
        * place the creator funnel can show us where people give up. */}
      <TrackView name="create_test_started" />
      <SiteHeader />
      <main className="wrap inner-page pb-16">
        <p className="eyebrow">Turn a guess into evidence</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight pb-1">Create a price test</h1>
        <p className="text-muted pb-7">
          Set up your offer, add the prices you&apos;re considering, then send one simple link. Create and collect
          responses for free. Unlock the full pricing report for $14.90 per test.
        </p>
        <CreateForm />
      </main>
      <SiteFooter />
    </>
  );
}
