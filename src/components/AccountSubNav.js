'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BASE_TABS = [
  { href: '/dashboard', label: 'My tests' },
  { href: '/account', label: 'Account' },
];

function isActiveTab(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The only consumer of this now — there's no header avatar left to share it with. */
function initialOf(user) {
  return (user.name || user.email || '?').trim().charAt(0).toUpperCase();
}

/**
 * Thin tab strip for the logged-in account area — the entire account-area UI
 * now (tabs, identity, log out), rendered by SiteHeader as its own sticky
 * element right under the header, on every page that renders SiteHeader. The
 * one page that never does, `/t/[slug]`, is unaffected by construction
 * (decision 9 — that page stays a neutral instrument).
 *
 * `sticky` with its own top offset, not just nested inside <header>'s sticky
 * box — see the comment in SiteChrome.js. The offset (`top-20`) matches the
 * header's rendered height (the `min-h-20` on HeaderChrome's wrap div now
 * governs at every breakpoint, since the logo no longer grows taller than
 * that on `sm:` and up); if the header's height ever changes again (logo
 * size, header padding), update this too.
 */
export function AccountSubNav({ user, isAdmin = false }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...BASE_TABS, { href: '/admin', label: 'Admin' }] : BASE_TABS;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Hard navigation, not router.push()+refresh() — those two fire as
    // separate transitions and race each other, so the header can render
    // with the stale (still-logged-in) RSC payload even though the session
    // cookie is already gone server-side. A full load has no cache to race.
    window.location.href = '/';
  }

  return (
    <div className="sticky top-20 z-40 border-b border-line bg-paper">
      <nav aria-label="Account navigation" className="wrap flex items-center justify-between gap-4 py-2.5">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = isActiveTab(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-ink text-white' : 'text-muted hover:bg-locked hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-white">
              {initialOf(user)}
            </span>
            <div className="leading-tight">
              <p className="max-w-[10rem] truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
              {/* Only worth a second line when it says something the name line didn't already. */}
              {user.name && <p className="max-w-[10rem] truncate text-xs text-muted">{user.email}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="shrink-0 text-sm font-semibold text-alert hover:underline"
          >
            Log out
          </button>
        </div>
      </nav>
    </div>
  );
}
