import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import wybiMark from '../../public/brand/wybi-mark.png';
import wybiLockup from '../../public/brand/wybi-lockup.png';
import { currentUser } from '../lib/session.js';
import { isAdminEmail } from '../lib/admin.js';
import { HeaderChrome } from './HeaderChrome.js';

/**
 * A server component that reads the session, not a client one — the request
 * that renders the page already knows who's logged in, so there is no
 * logged-out flash while a client component figures it out.
 *
 * Do not use this on a `force-static` page — `force-static` strips `cookies()`
 * down to nothing, so `currentUser()` would silently resolve to "logged out"
 * for every visitor no matter who they actually are (this bit the homepage
 * once already). Use SiteHeaderStatic there instead.
 */
export async function SiteHeader() {
  const user = await currentUser();
  const isAdmin = isAdminEmail(user?.email);

  return <HeaderChrome user={user} isAdmin={isAdmin} />;
}

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/#demo', label: 'Live demo' },
      { href: '/create', label: 'Create a price test' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/dashboard', label: 'My tests' },
      { href: '/account', label: 'Account' },
      // Dropped for a signed-in visitor — see `SiteFooter`. Logging out is a
      // POST (`/api/auth/logout`), so it can't be a plain footer link; the
      // header's AccountSubNav owns that.
      { href: '/login', label: 'Log in', loggedOutOnly: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/cookies', label: 'Cookie Policy' },
    ],
  },
];

/**
 * Two variants, on purpose.
 *
 * `minimal` (a text wordmark, not the logo lockup) is what renders on the
 * respondent page — kept visually quiet so nothing primes an answer, and
 * without the pricing/legal links that page has no bearing on. Attribution
 * enough to know whose site this is, no more.
 *
 * `full` is the real site footer: everything else (landing, dashboard,
 * create, account, results) is a "sell and delight" or "credible" surface
 * per the brand zones, so the standard dark footer belongs there. It reads
 * the session like `SiteHeader` does, so a logged-in visitor isn't offered
 * "Log in" two inches below their own name in the header. The one page where
 * that still shows stale is the `force-static` homepage, where `cookies()` is
 * empty at build time (see `SiteHeaderStatic`) — it bakes the logged-out
 * footer, same as it did before this was session-aware.
 *
 * The session read is skipped entirely on `minimal`: that variant renders on
 * the respondent page, which must never touch auth (decision 9).
 */
export async function SiteFooter({ variant = 'full' }) {
  if (variant === 'minimal') {
    return (
      <footer className="wrap py-10 text-center text-xs text-muted">
        {/* Tagline, then the full lockup below it — nothing else besides the
          * home link on the logo itself. Still attribution, not a navigation
          * bar: no nav links, no CTA, per decision 9 (this page stays a
          * measurement instrument) — a logo linking home is the one
          * exception every site on the internet gets away with. */}
        <p>Real people. Different prices. <span className="font-bold text-accent">Real answers.</span></p>
        <Link href="/" aria-label="Would You Buy It home" className="mt-3 inline-block">
          <Image src={wybiLockup} alt="Would You Buy It?" className="mx-auto h-6 w-auto object-contain" />
        </Link>
      </footer>
    );
  }

  const user = await currentUser();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white">
      <div className="wrap py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Would You Buy It home" className="inline-flex items-center gap-2.5">
              <Image src={wybiMark} alt="" className="h-9 w-9 object-contain" />
              <span className="text-lg font-extrabold tracking-tight text-white">Would You Buy It?</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Pricing research with real people. One hidden price per respondent, a deterministic report,
              no AI anywhere in the loop.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="text-xs font-bold uppercase tracking-wider text-white/45">{column.heading}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {column.links
                  .filter((link) => !(link.loggedOutOnly && user))
                  .map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-white/70 hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Would You Buy It. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            {/* Merchant of record, not just a payment processor — see terms#payments.
                Naming it here (not a card-logo image we'd have to keep licensed/updated)
                is the trust signal: Paddle handles the charge, tax and invoice. */}
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Secure checkout by Paddle
            </span>
            <a href="mailto:studiolimeta@gmail.com" className="hover:text-white">
              Contact support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/*
 * There was a `ViralCta` export here. It was never imported anywhere — the CTA
 * respondents actually see is rendered inline by RespondFlow — and it carried a
 * `data-event="viral_cta_clicked"` attribute that no listener ever read. Two
 * copies of the same CTA where only the unused one looked instrumented is how
 * the viral loop ended up with zero recorded clicks. The live one now tracks
 * itself; this one is gone rather than left to drift again.
 */
