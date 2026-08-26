import Link from 'next/link';
import Image from 'next/image';
import wybiLockup from '../../public/brand/wybi-lockup.png';
import { currentUser } from '../lib/session.js';
import { isAdminEmail } from '../lib/admin.js';
import { UserMenu } from './UserMenu.js';

/**
 * A server component that reads the session, not a client one — the request
 * that renders the page already knows who's logged in, so there is no
 * logged-out flash while a client component figures it out. Only the dropdown
 * itself (UserMenu) needs to be interactive.
 */
export async function SiteHeader() {
  const user = await currentUser();
  const isAdmin = isAdminEmail(user?.email);

  return (
    <header className="site-header sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="wrap flex min-h-20 items-center justify-between gap-4 py-4">
        <Link href="/" aria-label="Would You Buy It home" className="inline-flex shrink-0 items-center">
          {/* h-16 made the lockup 192px wide, which plus the nav overflowed a
            * 390px viewport and pushed the primary CTA off the right edge on
            * every page. The logo is the one thing here that can afford to
            * shrink — the CTA is the whole point of the header. */}
          <Image
            src={wybiLockup}
            alt="Would You Buy It?"
            className="h-11 w-auto object-contain sm:h-[4.5rem]"
            priority
          />
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
          <Link href="/#how-it-works" className="hidden text-sm font-semibold text-muted hover:text-ink sm:inline-flex">
            How it works
          </Link>

          {user ? (
            <>
              <Link href="/dashboard" className="hidden text-sm font-semibold text-muted hover:text-ink sm:inline-flex">
                My tests
              </Link>
              <UserMenu user={user} isAdmin={isAdmin} />
            </>
          ) : (
            <Link href="/login" className="whitespace-nowrap text-sm font-semibold text-muted hover:text-ink">
              Log in
            </Link>
          )}

          <Link href="/create" className="btn btn-primary px-3 py-2 text-sm sm:px-4">
            <span className="sm:hidden">Create test</span>
            <span className="hidden sm:inline">Create a price test</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

/*
 * Deliberately a text wordmark, not the logo lockup: this footer also renders
 * on the respondent page, which is kept visually quiet so nothing primes an
 * answer. Attribution enough to know whose site this is, no more.
 */
export function SiteFooter() {
  return (
    <footer className="wrap py-10 text-center text-xs text-muted">
      <p>Real people. Different prices. <span className="font-bold text-accent">Real answers.</span></p>
      <p className="mt-1">
        <Link href="/" className="underline">
          Would You Buy It?
        </Link>
      </p>
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
