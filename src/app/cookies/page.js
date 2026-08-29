import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LegalPage } from '../../components/LegalPage.js';

export const metadata = { title: 'Cookie Policy — Would You Buy It?' };

const UPDATED = 'August 29, 2026';

const COOKIES = [
  {
    name: 'wybi_vid',
    purpose: 'Anonymous respondent ID — stops the same browser voting twice on one price test.',
    duration: '1 year',
  },
  {
    name: 'wybi_mine',
    purpose: 'Remembers which tests you created on this browser, so /dashboard can list them without an account.',
    duration: '1 year',
  },
  {
    name: 'wybi_session',
    purpose: 'Keeps you signed in after Google or email sign-in.',
    duration: '120 days',
  },
];

export default function CookiesPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage title="Cookie Policy" updated={UPDATED}>
        <p>
          WYBI uses a small number of first-party cookies to make the product work — never third-party advertising
          or tracking cookies. Nothing here is used to build an ad profile, and none of it leaves our servers.
        </p>

        <h2>The cookies we set</h2>
        <ul>
          {COOKIES.map((cookie) => (
            <li key={cookie.name}>
              <strong>{cookie.name}</strong> ({cookie.duration}) — {cookie.purpose}
            </li>
          ))}
        </ul>
        <p>
          All three are <strong>strictly necessary</strong> — they exist to keep one vote per person honest, to
          keep you signed in, and to let anonymous creators find their own tests. None of them are optional
          extras, so there&apos;s no cookie banner asking you to opt in to marketing cookies: there aren&apos;t
          any.
        </p>

        <h2>What&apos;s not here</h2>
        <p>
          No advertising pixels, no social-media trackers, no marketing cookies. Two scripts do run in your browser
          for reasons other than tracking you across the web, and neither sets a cookie or any persistent
          identifier: <strong>Cloudflare Turnstile</strong>, an invisible bot-check on the voting page (so a
          test&apos;s results reflect real people, not scripts), and <strong>Umami</strong>, an open-source
          analytics tool we self-host on our own server for basic traffic stats (page views, referrers, browser
          mix). Detailed step-by-step funnel data (which step of a flow people reach) is recorded separately,
          first-party, server-side, into our own database — it doesn&apos;t use a cookie of its own beyond{' '}
          <strong>wybi_vid</strong> above. See the <Link href="/privacy">Privacy Policy</Link> for the full detail
          on both.
        </p>

        <h2>Managing cookies</h2>
        <p>
          You can clear or block these cookies from your browser&apos;s settings at any time. Blocking{' '}
          <strong>wybi_vid</strong> means our duplicate-vote check can&apos;t recognise your browser between
          visits; blocking <strong>wybi_session</strong> means you&apos;ll be signed out. Neither will stop you
          from using the core product.
        </p>

        <p>
          See the <Link href="/privacy">Privacy Policy</Link> for what we do with the data these cookies enable.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
