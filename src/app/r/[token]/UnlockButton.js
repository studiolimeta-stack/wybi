'use client';

import Script from 'next/script';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

// `price`, `paddleEnabled`, etc. arrive pre-computed from the server
// component. lib/config.js validates required env vars at module-eval time,
// which is exactly right for a server-only module and exactly wrong to ever
// import from a 'use client' file — webpack would evaluate it in the browser
// bundle and it would throw.
export function UnlockButton({
  token,
  paddleEnabled,
  paddleClientToken,
  paddleEnvironment,
  paddlePriceId,
  customerEmail,
  price,
  totalResponses,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const paddleInitialised = useRef(false);

  function initPaddle() {
    if (paddleInitialised.current || typeof window === 'undefined' || !window.Paddle) return;
    if (paddleEnvironment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: paddleClientToken,
      eventCallback(event) {
        // `checkout.completed` only means the browser saw a successful
        // charge — it is NOT proof of payment (it can't be verified server
        // side). It's just the cue to start polling for what the
        // `transaction.completed` webhook has actually confirmed.
        if (event.name === 'checkout.completed') pollForUnlock();
        if (event.name === 'checkout.closed') setBusy(false);
      },
    });
    paddleInitialised.current = true;
  }

  async function pollForUnlock(attempt = 0) {
    try {
      const res = await fetch(`/api/tests/${token}/unlock`);
      const data = await res.json();
      if (data?.paid) {
        router.push(`${pathname}?unlocked=1`);
        return;
      }
    } catch {
      // transient — fall through to retry below rather than surfacing an
      // error while the webhook may still land a second later.
    }
    if (attempt >= 10) {
      setBusy(false);
      setError('Payment received — finishing up. Refresh in a few seconds if the report is still locked.');
      return;
    }
    setTimeout(() => pollForUnlock(attempt + 1), 1000);
  }

  async function unlockMock() {
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

  function unlock() {
    setBusy(true);
    setError(null);

    if (!paddleEnabled) {
      unlockMock();
      return;
    }

    initPaddle();
    if (!window.Paddle) {
      setError('Payments are still loading — try again in a second.');
      setBusy(false);
      return;
    }

    window.Paddle.Checkout.open({
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      customData: { creatorToken: token },
      ...(customerEmail ? { customer: { email: customerEmail } } : {}),
    });
  }

  return (
    <div>
      {paddleEnabled && (
        <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" onLoad={initPaddle} />
      )}
      <button
        type="button"
        className="btn btn-primary btn-wrap mt-5 w-full sm:w-auto"
        onClick={unlock}
        disabled={busy}
      >
        {busy ? 'Unlocking…' : `Unlock all ${totalResponses} responses — ${price}`}
      </button>
      <p className="hint mt-2">One-time payment · This test stays unlocked · Future responses included</p>
      {!paddleEnabled && (
        <p className="hint mt-1">
          Payments aren’t live yet — unlocking now simulates a successful purchase so you can preview the full
          report. No card is charged.
        </p>
      )}
      {error && <p className="err mt-1">{error}</p>}
    </div>
  );
}
