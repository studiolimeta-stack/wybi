'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AccountActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logoutEverywhere() {
    setBusy(true);
    await fetch('/api/account/logout-everywhere', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        'Deleting your account will remove your login and account information. Your existing pricing tests and their responses will not be deleted and can still be accessed through their private results links. Delete tests individually if you want to remove them. This cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch('/api/account/delete', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="card mt-4 p-6">
      <h2 className="text-lg font-extrabold tracking-tight">Session</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-plain" disabled={busy} onClick={logoutEverywhere}>
          Log out everywhere
        </button>
        {/* Destructive — text-alert, never the brand purple every primary action wears. */}
        <button type="button" className="btn btn-plain text-alert" disabled={busy} onClick={deleteAccount}>
          Delete account
        </button>
      </div>
      <p className="hint mt-3">
        Deleting your account removes your login and account information. Your pricing tests and responses stay
        available through their private results links. Delete tests individually if you want to remove them.
      </p>
    </div>
  );
}
