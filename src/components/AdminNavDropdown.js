'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

const PANEL_WIDTH = 208;
const VIEWPORT_MARGIN = 8;

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/tests', label: 'Tests' },
];

function isActiveSection(pathname, href) {
  // '/admin' itself must match exactly — every other section's href is also
  // a prefix of nothing else here, but '/admin' is a prefix of ALL of them,
  // so it's the one case `startsWith` would wrongly mark active everywhere.
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Same portal + fixed-position technique as ManageTestMenu, and for the same
 * reason: this sits inside AccountSubNav's `overflow-x-auto` tab strip, which
 * would clip a naively-nested absolute dropdown instead of letting it float
 * over the page.
 *
 * Replaces the single "Admin" tab now that admin is four separate pages
 * (Overview/Users/Payments/Tests) instead of one long scroll — this is the
 * one place to jump between them without going back through Overview first.
 */
export function AdminNavDropdown() {
  const pathname = usePathname();
  // Token-authed access (`?key=`) has no session, so it never reaches this
  // component at all (see AccountSubNav — it only renders when `user` is
  // set). This read only matters for a session-authed admin who ALSO has a
  // `?key=` in the URL (e.g. followed an old bookmarked link while logged
  // in) — carry it through rather than silently dropping it on the first
  // dropdown click.
  const searchParams = useSearchParams();
  const key = searchParams.get('key');

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const active = SECTIONS.some((s) => isActiveSection(pathname, s.href));

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
    setCoords({ top: rect.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (buttonRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onClose() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          active ? 'bg-ink text-white' : 'text-muted hover:bg-locked hover:text-ink'
        }`}
      >
        Admin
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="z-50 overflow-hidden rounded-2xl border-1.5 border-line bg-white p-1.5 shadow-[0_8px_24px_rgba(30,35,64,0.16)]"
          >
            {SECTIONS.map((s) => {
              const isActive = isActiveSection(pathname, s.href);
              const href = key ? `${s.href}?key=${encodeURIComponent(key)}` : s.href;
              return (
                <Link
                  key={s.href}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-locked ${
                    isActive ? 'text-accent' : ''
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
