'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckIcon } from '../../../components/CheckIcon.js';

/**
 * The reward moment (WYBY-03 §15) — shown once, right after `UnlockButton`
 * takes the creator from locked to paid. `router.refresh()` alone already
 * swaps the paywall for the real report instantly; this just makes that swap
 * legible as "you just paid for something," instead of the page silently
 * looking different.
 *
 * Driven by a one-shot `?unlocked=1` query param rather than local component
 * state, because the unlock happens in a *different* component (`UnlockButton`,
 * possibly a different instance of it further down this same page) — a query
 * param is the simplest thing both can agree on across that boundary. Stripped
 * from the URL immediately via `router.replace` so refreshing the page later
 * never re-shows it.
 */
export function UnlockToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('unlocked') !== '1') return;
    setVisible(true);
    router.replace(pathname, { scroll: false });
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount, not on every searchParams identity change
  }, []);

  if (!visible) return null;

  return (
    <div className="card p-4 bg-ok border-ok text-white flex items-start gap-2.5" role="status">
      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-white" />
      <div>
        <p className="font-bold">Full report unlocked</p>
        <p className="text-sm text-white/85 mt-0.5">
          All current and future responses for this test are now included.
        </p>
      </div>
    </div>
  );
}
