'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * Client-side analytics beacons (PRD §37).
 *
 * These three events cannot be written server-side: the homepage is
 * force-static, "create started" is a client interaction rather than a request,
 * and the viral CTA is a click that navigates away. Before this file they were
 * declared in EVENT_NAMES and never fired once — which left the top of the
 * creator funnel and the entire viral loop unmeasurable in /admin.
 *
 * Everything here is fire-and-forget: /api/events already swallows its own
 * errors and answers 204, and an analytics ping must never block a navigation.
 */
function beacon(name, slug) {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slug ? { name, slug } : { name }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Fires once when the page mounts.
 *
 * The ref guard is not optional: React StrictMode double-invokes effects in
 * development, and without it every local page view would be counted twice.
 */
export function TrackView({ name, slug = null }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    beacon(name, slug);
  }, [name, slug]);

  return null;
}

/** A Link that reports a click before navigating. */
export function TrackedLink({ event, slug = null, children, ...props }) {
  return (
    <Link {...props} onClick={() => beacon(event, slug)}>
      {children}
    </Link>
  );
}
