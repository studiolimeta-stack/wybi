'use client';

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareBox } from '../../../components/ShareBox.js';

/**
 * "Share this test" next to "View respondent page" / "Manage this test" — the
 * full ShareBox (WhatsApp, X, Facebook, LinkedIn, Reddit, email, native share
 * sheet), not just a bare copy-link button, so anyone who wants to send this
 * to more people doesn't have to go back to /created/[token] to find it.
 *
 * A centered modal rather than an anchored dropdown like ManageTestMenu — the
 * social grid needs real width, and a fixed-position overlay sidesteps any
 * risk of a wide dropdown overflowing a narrow viewport depending on where in
 * the wrapped button row it happens to sit.
 */
export function ShareTestButton({ shareUrl, title }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-plain shrink-0 px-3 py-2 text-sm sm:px-4" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share this test
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share this test"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16 sm:items-center sm:pt-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-md">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-extrabold shadow-[0_2px_6px_rgba(30,35,64,0.16)] hover:bg-locked"
            >
              ✕
            </button>
            <ShareBox shareUrl={shareUrl} title={title} />
          </div>
        </div>
      )}
    </>
  );
}
