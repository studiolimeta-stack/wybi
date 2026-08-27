'use client';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 15_000;

/**
 * Live "visitors online now" tile for /admin. Server-rendered with the count
 * as of page load (`initialVisitors`), then polls the API route so the
 * number keeps moving without a full page refresh. Renders nothing if
 * Umami admin access isn't configured — the parent already decided that by
 * only mounting this when `data.traffic` is non-null.
 */
export default function OnlineNow({ initialVisitors, tokenQuery = '' }) {
  const [visitors, setVisitors] = useState(initialVisitors);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/admin/online-now${tokenQuery}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVisitors(data.visitors);
      } catch {
        // A missed poll just leaves the last known number on screen.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tokenQuery]);

  if (visitors === null || visitors === undefined) return null;

  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Online now</p>
      <p className="text-2xl font-extrabold flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
        {visitors}
      </p>
    </div>
  );
}
