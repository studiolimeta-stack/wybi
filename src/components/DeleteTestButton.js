'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

/**
 * Deletes straight from an admin listing (`/admin/tests`, and the "Reported
 * tests" panel on `/admin`) instead of requiring a click through to
 * `/r/[token]`'s "Manage this test" menu first. Deliberately calls the SAME
 * `DELETE /api/tests/[token]` route that page already uses — the
 * creator_token is the real credential either way (decision 8), and every
 * admin query already selects it, so this needs no new admin-only mutation
 * route, just a shorter path to the one that already exists.
 */
export function DeleteTestButton({ token }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove() {
    if (!window.confirm('Delete this test and every response it collected? This cannot be undone.')) return;
    setBusy(true);
    const res = await fetch(`/api/tests/${token}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      window.alert('Could not delete this test.');
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={remove}
      aria-label="Delete this test"
      title="Delete this test"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-alert hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{busy ? 'Deleting…' : 'Delete this test'}</span>
    </button>
  );
}
