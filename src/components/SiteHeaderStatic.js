'use client';

import { useEffect, useState } from 'react';
import { HeaderChrome } from './HeaderChrome.js';

/**
 * Drop-in replacement for `<SiteHeader />` on pages that are
 * `dynamic = 'force-static'` (currently just the homepage, kept static so the
 * highest-traffic page serves from cache with zero per-request server work —
 * see the TrackView comment on that page for the same constraint hitting
 * analytics). `force-static` strips `cookies()` down to nothing at build time,
 * so a server-rendered header would always bake in "logged out," even for a
 * signed-in visitor loading the cached HTML.
 *
 * Renders logged-out first — identical to what's in the cached HTML, so no
 * hydration mismatch — then quietly checks /api/auth/me on mount and swaps in
 * the real session if there is one. A real visitor sees at most a brief flash
 * before it corrects; this trade is only made on the one page that needs it.
 */
export function SiteHeaderStatic() {
  const [session, setSession] = useState({ user: null, isAdmin: false });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) setSession({ user: data.user, isAdmin: !!data.isAdmin });
      })
      .catch(() => {
        // Stays logged-out on any failure — same as an expired/absent session.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <HeaderChrome user={session.user} isAdmin={session.isAdmin} />;
}
