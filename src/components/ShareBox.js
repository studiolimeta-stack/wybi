'use client';

import { useState } from 'react';

/**
 * One-click sharing (PRD §36). Share text is intentionally casual and
 * first-person — this link gets pasted into group chats, not press releases.
 *
 * Shared between `/created/[token]` (first thing you see after creating a
 * test) and the "Share this test" modal on `/r/[token]` (every visit after
 * that) — same links, same tracked events, one implementation.
 */
export function ShareBox({ shareUrl, title }) {
  const [copied, setCopied] = useState(false);

  const message = `I need an honest opinion 😄\n\nThinking about selling this — would you actually buy it?\n\nTakes 5 seconds:`;

  function report(event) {
    // Fire-and-forget: analytics must never delay opening the share sheet.
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: event }),
      keepalive: true,
    }).catch(() => {});
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard API is blocked in some in-app browsers; the input below is selectable.
    }
    setCopied(true);
    report('test_link_copied');
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!navigator.share) {
      copy();
      return;
    }

    try {
      await navigator.share({
        title: `Would you buy ${title}?`,
        text: message,
        url: shareUrl,
      });
      report('share_native_clicked');
    } catch {
      // Dismissing the system share sheet is a normal outcome.
    }
  }

  const links = [
    {
      label: 'WhatsApp',
      event: 'share_whatsapp_clicked',
      href: `https://wa.me/?text=${encodeURIComponent(`${message}\n${shareUrl}`)}`,
    },
    {
      label: 'Email',
      event: 'share_email_clicked',
      href: `mailto:?subject=${encodeURIComponent(`Would you buy ${title}?`)}&body=${encodeURIComponent(`${message}\n${shareUrl}`)}`,
    },
    {
      label: 'LinkedIn',
      event: 'share_linkedin_clicked',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'X',
      event: 'share_x_clicked',
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(`Would you actually buy this? Takes 5 seconds:`)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Facebook',
      event: 'share_facebook_clicked',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Reddit',
      event: 'share_reddit_clicked',
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`Would you buy ${title}?`)}`,
    },
  ];

  return (
    <div className="card p-6">
      <label className="label" htmlFor="shareUrl">
        Your test link
      </label>
      <div className="flex gap-2">
        <input
          id="shareUrl"
          className="field font-mono text-sm"
          value={shareUrl}
          readOnly
          onFocus={(event) => event.target.select()}
        />
        <button type="button" className="btn btn-primary shrink-0" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>

      <p className="label mt-6">Send it</p>
      <button type="button" className="btn btn-primary mb-3 w-full" onClick={share}>
        Share to more apps
      </button>
      <div className="grid grid-cols-2 gap-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-plain"
            onClick={() => report(link.event)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
