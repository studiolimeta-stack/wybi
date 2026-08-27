import Link from 'next/link';
import Image from 'next/image';
import wybiLockup from '../../public/brand/wybi-lockup.png';
import { AccountSubNav } from './AccountSubNav.js';

/**
 * The actual header markup — its own module, with zero server-only imports
 * (no `next/headers`, no db access), so it can be rendered two ways: directly
 * by the server `SiteHeader` (the normal case — correct on every per-request
 * page, no logged-out flash), or from inside the client `SiteHeaderStatic`
 * for the one page that can't do a per-request render at all. If this lived
 * in the same file as `SiteHeader` (which imports `lib/session.js` →
 * `lib/db.js` → `pg`), importing it from a client component would drag that
 * whole server-only chain into the browser bundle and fail to build.
 *
 * No avatar/account affordance lives in the top bar itself anymore — once
 * logged in, AccountSubNav (tabs, initials, name/email, log out) is the one
 * place all of that lives, so there's nothing left to duplicate up here.
 */
export function HeaderChrome({ user, isAdmin }) {
  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm">
        <div className="wrap flex min-h-20 items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" aria-label="Would You Buy It home" className="inline-flex shrink-0 items-center">
              {/* h-16 made the lockup 192px wide, which plus the nav overflowed a
                * 390px viewport and pushed the primary CTA off the right edge on
                * every page. The logo is the one thing here that can afford to
                * shrink — the CTA is the whole point of the header. */}
              <Image
                src={wybiLockup}
                alt="Would You Buy It?"
                className="h-8 w-auto object-contain sm:h-12"
                priority
              />
            </Link>

            <nav aria-label="Main navigation" className="hidden items-center gap-5 sm:flex">
              <Link href="/#how-it-works" className="text-sm font-semibold text-muted hover:text-ink">
                How it works
              </Link>
              <Link href="/#demo" className="text-sm font-semibold text-muted hover:text-ink">
                Live demo
              </Link>
              <Link href="/#pricing" className="text-sm font-semibold text-muted hover:text-ink">
                Pricing
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {!user && (
              <Link href="/login" className="btn btn-plain px-3 py-2 text-sm sm:px-4">
                Log in
              </Link>
            )}

            <Link href="/create" className="btn btn-primary px-3 py-2 text-sm sm:px-4">
              <span className="sm:hidden">Create test</span>
              <span className="hidden sm:inline">Create a price test</span>
            </Link>
          </div>
        </div>
      </header>

      {/*
       * Its own sticky element, offset by the header's rendered height
       * (5rem/80px on mobile, 6.5rem/104px from `sm:` up where the taller
       * logo grows the header) — not just nested inside <header>'s sticky
       * box. Explicit rather than relying on "it's a child of a sticky
       * element so it rides along", so it keeps behaving if the header's
       * own stickiness ever changes.
       */}
      {user && <AccountSubNav user={user} isAdmin={isAdmin} />}
    </>
  );
}
