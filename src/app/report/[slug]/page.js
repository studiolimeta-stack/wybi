import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTestBySlug, reportTest, checkRateLimit } from '../../../lib/tests.js';
import { readVisitorId } from '../../../lib/visitor.js';
import { clientIp, hashIp } from '../../../lib/ids.js';
import { query } from '../../../lib/db.js';
import { SiteFooter } from '../../../components/SiteChrome.js';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Report this test', robots: { index: false, follow: false } };

const REASONS = ['Scam or fraud', 'Illegal product', 'Offensive content', 'Spam or malware link', 'Something else'];

function Submitted({ slug }) {
  return (
    <main className="wrap py-20 text-center">
      <p className="text-4xl">✓</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Report received.</h1>
      <p className="mt-2 text-muted">
        A human will look at it. You don&apos;t need to do anything else.
      </p>
      <Link href={`/t/${slug}`} className="btn btn-plain mt-7 inline-block">
        ← Back to the test
      </Link>
    </main>
  );
}

export default async function ReportPage({ params, searchParams }) {
  const { slug } = await params;
  const { sent } = await searchParams;
  const test = await getTestBySlug(slug);
  if (!test) notFound();

  if (sent) {
    return (
      <>
        <Submitted slug={test.slug} />
        <SiteFooter />
      </>
    );
  }

  async function submitReport(formData) {
    'use server';
    const reason = String(formData.get('reason') || '').slice(0, 200);
    const visitorId = await readVisitorId();

    /*
     * Two guards, because reported_count feeds the admin queue and an
     * unguarded form is a one-line script away from burying every real report
     * under a flood — and from making an honest test look mass-flagged.
     *
     * Both failures still land on the thank-you screen. Telling a spammer
     * which of their submissions counted just tells them how to tune the next
     * attempt, and a genuine double-click should not read as an error.
     */
    const ipHash = hashIp(clientIp(await headers()));
    if (await checkRateLimit('events', ipHash)) {
      const { rows } = await query(
        'SELECT 1 FROM test_reports WHERE test_id = $1 AND visitor_id = $2 LIMIT 1',
        [test.id, visitorId],
      );
      if (!rows.length) await reportTest(test.id, reason, visitorId);
    }

    redirect(`/report/${test.slug}?sent=1`);
  }

  return (
    <>
      <main className="wrap py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Report this test</h1>
        <p className="mt-2 text-muted">
          Flagging <strong>{test.title}</strong>. Reports go to a human, not an algorithm.
        </p>

        <form action={submitReport} className="card mt-6 p-6 space-y-3">
          {REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="reason" value={reason} required className="h-4 w-4" />
              <span>{reason}</span>
            </label>
          ))}
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Submit report
          </button>
        </form>

        <Link href={`/t/${test.slug}`} className="btn-ghost mt-5 inline-block text-sm">
          ← Back
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
