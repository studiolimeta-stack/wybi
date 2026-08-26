'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// `price` arrives pre-formatted from the server component. lib/config.js
// validates required env vars at module-eval time, which is exactly right for
// a server-only module and exactly wrong to ever import from a 'use client'
// file — webpack would evaluate it in the browser bundle and it would throw.
export function UnlockButton({ token, stripeEnabled, price }) {
  const router = useRouter();
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
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-primary mt-5 w-full sm:w-auto" onClick={unlock} disabled={busy}>
        {busy ? 'Unlocking…' : `Unlock your full pricing report — ${price}${stripeEnabled ? '' : ' (dev mode)'}`}
      </button>
      <p className="hint mt-2">
        {stripeEnabled
          ? 'Secure checkout — you’ll be back here right after.'
          : 'Card payments aren’t connected yet — this simulates a successful purchase so the rest of the flow can be built and tested.'}
      </p>
      {error && <p className="err mt-1">{error}</p>}
    </div>
  );
}
