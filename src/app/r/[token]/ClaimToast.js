'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckIcon } from '../../../components/CheckIcon.js';

/**
 * The reward moment for claiming a test into an account — mirrors
 * `UnlockToast` exactly (same one-shot query-param + `router.replace` shape),
 * but keyed on `?claimed=1` and deliberately independent of `test.is_paid`:
 * claiming and paying are unrelated events, and this must show for a free
 * test just as much as a paid one.
 *
 * Fires after both claim paths: the automatic claim on signup/login from the
 * `/created/[token]` success page (via the existing `next=` redirect, spec
 * §12), and the explicit "Add to my account" cross-device claim below on
 * this same page (spec §15).
 */
export function ClaimToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('claimed') !== '1') return;
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
        <p className="font-bold">Test saved to your account</p>
        <p className="text-sm text-white/85 mt-0.5">You can now access it from any device.</p>
      </div>
    </div>
  );
}
