'use client';

import { TrackedLink } from './Track.js';

/**
 * The "Learn more" link out to the creator's own product page.
 *
 * Split out of OfferCard (2026-08-31) because it's an unmeasured exit path —
 * rendering it unconditionally in OfferCard put it in front of a respondent
 * before they'd answered, on the one page whose whole design principle
 * (decision 9) is "nothing that could pull someone away before they answer".
 * Callers render this themselves, only once the respondent is past that
 * point (RespondFlow's `done` step; the "already answered" branch of
 * t/[slug]/page.js) — see OfferCard's docstring.
 *
 * Tracked via TrackedLink/`product_link_clicked` (previously not tracked at
 * all) so how often it's actually used is finally visible in /admin.
 */
export function ProductLink({ url, slug = null, className = 'inline-block text-sm font-semibold underline' }) {
  if (!url) return null;

  return (
    <TrackedLink
      event="product_link_clicked"
      slug={slug}
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className={className}
    >
      Learn more
    </TrackedLink>
  );
}
