'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function initialOf(user) {
  return (user.name || user.email || '?').trim().charAt(0).toUpperCase();
}

/** The only client-interactive piece of the header — everything else is server-rendered. */
export function UserMenu({ user, isAdmin = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-white px-2 py-1.5 pr-3 text-sm font-semibold shadow-[0_2px_6px_rgba(30,35,64,0.12)] hover:bg-locked sm:pr-3.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-white">
          {initialOf(user)}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{user.name || user.email}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border-1.5 border-line bg-white shadow-[0_8px_24px_rgba(30,35,64,0.16)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold">{user.name || 'Your account'}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-locked sm:hidden"
            onClick={() => setOpen(false)}
          >
            My tests
          </Link>
          <Link
            href="/account"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-locked"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-semibold text-accent hover:bg-locked"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-alert hover:bg-locked"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
