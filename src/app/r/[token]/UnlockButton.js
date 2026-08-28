'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

// `price` arrives pre-formatted from the server component. lib/config.js
// validates required env vars at module-eval time, which is exactly right for
// a server-only module and exactly wrong to ever import from a 'use client'
// file — webpack would evaluate it in the browser bundle and it would throw.
export function UnlockButton({ token, stripeEnabled, price, totalResponses }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tests/${token}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not unlock right now.');
        setBusy(false);
        return;
      }
      // `?unlocked=1` (read by UnlockToast, then stripped) rather than a plain
      // router.refresh() — this still re-fetches the same server component and
      // swaps in the paid report instantly, but also gives the reward moment a
      // signal to key off, since the unlock and the toast are different components.
      router.push(`${pathname}?unlocked=1`);
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary btn-wrap mt-5 w-full sm:w-auto"
        onClick={unlock}
        disabled={busy}
      >
        {busy ? 'Unlocking…' : `Unlock all ${totalResponses} responses — ${price}`}
      </button>
      <p className="hint mt-2">One-time payment · This test stays unlocked · Future responses included</p>
      {/* Paddle is the real, contracted payment processor (see /terms, /privacy) but
        * isn't wired up yet — wiring it is a separate, later step. Until then this is
        * genuinely a simulated purchase, so it says so, just without alarming
        * "(dev mode)" styling in the main CTA. Remove this block once Paddle is live. */}
      {!stripeEnabled && (
        <p className="hint mt-1">
          Payments aren’t live yet — unlocking now simulates a successful purchase so you can preview the full
          report. No card is charged.
        </p>
      )}
      {error && <p className="err mt-1">{error}</p>}
    </div>
  );
}
