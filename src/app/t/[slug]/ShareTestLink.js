'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

/**
 * The lightweight, respondent-side half of the viral loop — separate from the
 * "Test your own product" / "Test yours in 30 seconds" CTA next to it, which
 * is the creator-recruiting loop (PRD §35, tracked as `viral_cta_clicked`).
 * This one lets someone who already answered bring in the *next* respondent,
 * which is a different action worth its own event (`respondent_share_clicked`)
 * so the two loops don't get blended in /admin.
 *
 * Shared between `RespondFlow`'s `done` step (just answered) and `t/[slug]`
 * page.js's "already answered" branch (a returning visitor) — same copy, same
 * behaviour, same event, one implementation instead of two that could drift.
 * Deliberately not used by HomeDemo or PreviewModal — neither has a real,
 * persisted `/t/[slug]` URL to share.
 *
 * Styled with `.btn-ghost` on purpose — small, muted, underlined — so it never
 * competes with the real CTA button next to it (decision 9: nothing on this
 * page should read as a sell).
 */
export function ShareTestLink({ slug, title }) {
  const [linkCopied, setLinkCopied] = useState(false);

  async function shareTest() {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'respondent_share_clicked', slug }),
      keepalive: true,
    }).catch(() => {});

    // Always the plain /t/[slug] URL, built fresh — never window.location.href
    // as-is, which could be carrying this visitor's own utm/referrer params
    // forward and misattributing the next respondent's traffic.
    const shareUrl = `${window.location.origin}/t/${slug}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Would you buy ${title}?`, url: shareUrl });
      } catch {
        // Dismissing the system share sheet is a normal outcome, not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard API is blocked in some in-app browsers — nothing else to fall back to here.
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="hint">Know someone whose opinion would be useful?</p>
      <button type="button" className="btn-ghost mt-1 inline-flex items-center gap-1.5 text-sm" onClick={shareTest}>
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        {linkCopied ? 'Link copied' : 'Share this test'}
      </button>
    </div>
  );
}
