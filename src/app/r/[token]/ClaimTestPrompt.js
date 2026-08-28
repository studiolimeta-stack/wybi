'use client';

import { useState } from 'react';

/**
 * Cross-device claiming (spec §15). Only ever rendered by the server
 * component when it has already confirmed `currentUser()` is set AND
 * `test.user_id IS NULL` — this component doesn't re-check either, it just
 * asks for a confirming click before mutating ownership, same "explicit
 * click, not an automatic page-load side effect" shape as `UnlockButton`.
 *
 * Hard-navigates to `?claimed=1` on success (not `router.push`) so
 * `ClaimToast` — and every other server-rendered value derived from
 * `test.user_id` on this page, e.g. the "Saved to your account" framing
 * elsewhere in the app — reflects the new ownership immediately.
 */
export function ClaimTestPrompt({ token }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tests/${token}/claim`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add this test to your account.');
        setBusy(false);
        return;
      }
      window.location.href = `/r/${token}?claimed=1`;
    } catch {
      setError('Could not reach the server.');
      setBusy(false);
    }
  }

  return (
    <div className="card p-6 bg-locked">
      <p className="font-extrabold">Add this test to your account?</p>
      <p className="mt-1 text-sm text-muted">Save it to your dashboard and access it from any device.</p>
      <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={claim} disabled={busy}>
        {busy ? 'Adding…' : 'Add to my account'}
      </button>
      {error && <p className="err mt-2">{error}</p>}
    </div>
  );
}
