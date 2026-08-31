'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The one mutating control on an otherwise read-only admin page (see the
 * docstring on the API route this calls). `banned` is the current state as
 * rendered by the server; `adminKey` is only non-null when the admin got
 * here via `?key=` rather than a session, and is forwarded so the PATCH
 * authorises the same way the page load did. (Named `adminKey`, not `key` —
 * `key` is a reserved React prop name that never reaches the component.)
 */
export function BanUserButton({ userId, banned, adminKey }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    const confirmMessage = banned
      ? 'Unban this account? They will be able to log in again.'
      : 'Ban this account? This logs them out everywhere, blocks future logins, and pauses their active tests.';
    if (!window.confirm(confirmMessage)) return;

    setBusy(true);
    const url = adminKey ? `/api/admin/users/${userId}?key=${encodeURIComponent(adminKey)}` : `/api/admin/users/${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !banned }),
    });
    setBusy(false);
    if (!res.ok) {
      window.alert(`Could not ${banned ? 'unban' : 'ban'} this account.`);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      className={`btn ${banned ? 'btn-plain' : 'btn-plain text-alert'}`}
    >
      {busy ? 'Working…' : banned ? 'Unban account' : 'Ban account'}
    </button>
  );
}
