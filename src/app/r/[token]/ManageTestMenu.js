'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Pause, Play, Download, Trash2 } from 'lucide-react';

const menuItem =
  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-locked';
const PANEL_WIDTH = 256; // matches w-64 below — kept as a number so the position math can clamp against it
const VIEWPORT_MARGIN = 8;

/**
 * Was a full-width "Manage this test" card at the very bottom of the page —
 * the one place you'd land after creating a test and sending the link is the
 * one place these actions weren't reachable without scrolling past the whole
 * report. Now next to the title, so it's there the instant you land, on
 * every visit, not just the first one.
 *
 * A real dropdown at every breakpoint, including mobile — rendered through a
 * portal into `document.body` with computed `position: fixed` coordinates,
 * not nested inside the button's own DOM position. That sidesteps any
 * ancestor `overflow`/`z-index` stacking context clipping or burying the
 * panel (the button row this lives in wraps rather than scrolls on mobile,
 * but the portal approach is the more robust default regardless of that)
 * instead of trading the dropdown for a modal on mobile.
 */
export function ManageTestMenu({ token, status, locked }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const router = useRouter();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.right - PANEL_WIDTH, VIEWPORT_MARGIN),
      window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
    );
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
    // Closes rather than re-anchoring on scroll/resize — simpler than tracking
    // a moving target, and scrolling away from a button you just opened a menu
    // on is a reasonable signal you're done with it. `capture: true` on scroll
    // so this also fires for the horizontally-scrolling button row itself,
    // whose scroll events don't bubble to window.
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

  async function setStatus(next) {
    setBusy(true);
    await fetch(`/api/tests/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Delete this test and every response it collected? This cannot be undone.')) return;
    setBusy(true);
    await fetch(`/api/tests/${token}`, { method: 'DELETE' });
    router.push('/dashboard');
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-plain shrink-0 px-3 py-2 text-sm sm:px-4"
      >
        Manage this test
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
            {status === 'active' ? (
              <button type="button" disabled={busy} className={menuItem} onClick={() => setStatus('paused')}>
                <Pause className="h-4 w-4 shrink-0" />
                Pause test
              </button>
            ) : (
              <button type="button" disabled={busy} className={menuItem} onClick={() => setStatus('active')}>
                <Play className="h-4 w-4 shrink-0" />
                Resume test
              </button>
            )}

            <a
              className={`${menuItem} ${locked ? 'pointer-events-none opacity-40' : ''}`}
              href={locked ? '#' : `/api/tests/${token}/export`}
              onClick={() => setOpen(false)}
            >
              <Download className="h-4 w-4 shrink-0" />
              Export CSV
            </a>

            {/* Destructive, so it must not wear the brand purple every primary
              * action uses — text-alert is the only red the palette allows for text.
              * Icon uses currentColor (lucide default), so text-alert on the button
              * colors both the label and the icon together. */}
            <button type="button" disabled={busy} className={`${menuItem} text-alert`} onClick={remove}>
              <Trash2 className="h-4 w-4 shrink-0" />
              Delete test
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
