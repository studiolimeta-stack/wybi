'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ResultsActions({ token, shareUrl, status, locked }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your test link:', shareUrl);
    }
  }

  async function setStatus(next) {
    setBusy(true);
    await fetch(`/api/tests/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Delete this test and every response it collected? This cannot be undone.')) return;
    setBusy(true);
    await fetch(`/api/tests/${token}`, { method: 'DELETE' });
    router.push('/dashboard');
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight">Manage this test</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-plain" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy share link'}
        </button>

        {status === 'active' ? (
          <button type="button" className="btn btn-plain" disabled={busy} onClick={() => setStatus('paused')}>
            Pause test
          </button>
        ) : (
          <button type="button" className="btn btn-plain" disabled={busy} onClick={() => setStatus('active')}>
            Resume test
          </button>
        )}

        <a
          className={`btn btn-plain ${locked ? 'pointer-events-none opacity-40' : ''}`}
          href={locked ? '#' : `/api/tests/${token}/export`}
        >
          Export CSV
        </a>

        {/* Destructive, so it must not wear the brand purple that every primary
          * action uses — text-alert is the only red the palette allows for text. */}
        <button type="button" className="btn btn-plain text-alert" disabled={busy} onClick={remove}>
          Delete test
        </button>
      </div>
    </div>
  );
}
