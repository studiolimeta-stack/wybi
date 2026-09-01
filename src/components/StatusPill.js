/**
 * Central home for the label/badge tiers used across dashboard, admin and
 * account pages. Before this existed, every page hand-rolled its own
 * ternary — which is exactly how /dashboard's "Paid" pill quietly lost its
 * green outline, and /admin/users/[id]'s status pill ended up colored by
 * `is_paid` instead of `status` (an active-but-unpaid test rendered as
 * "locked", a paused-but-paid one rendered green). One file, so a new page
 * can't reinvent either bug.
 *
 * Tiers:
 *   1. Run-state  (TestStatusPill) — the one thing worth scanning for first:
 *      is this test still collecting data. `active` = solid green fill,
 *      everything else (paused/completed/draft) = plain neutral outline.
 *   2. Confirmed  (ConfirmedPill)  — paid / verified / unlocked facts about
 *      THIS record. Always the same green outline — don't invent a second
 *      "kind of green".
 *   3. Neutral    (NeutralPill)    — nothing to act on, nothing confirmed.
 *   4. Free       (FreePill)       — the pale yellow `--color-locked` tint is
 *      reserved for "you haven't unlocked this yet" nudges sitting on a
 *      plain white surface. Inside a card that's ALREADY `bg-locked`, use
 *      NeutralPill instead — stacking the same tint on itself just
 *      disappears.
 *   5. Alert      (AlertPill)      — banned / destructive, red outline.
 *
 * Marketing tags (landing-page pricing tiers, "Live demo", etc.) are
 * deliberately NOT covered here — those live in the "sell and delight" zone
 * and use the brand accent (`.eyebrow`, `bg-accent`) rather than a status
 * color, since they're naming a plan or a demo, not reporting a fact about
 * a specific test or account.
 */

export function TestStatusPill({ status, className = '' }) {
  const isActive = status === 'active';
  return (
    <span className={`pill ${isActive ? 'bg-ok text-white border-ok' : 'bg-white'} ${className}`.trim()}>
      {status}
    </span>
  );
}

export function ConfirmedPill({ children, className = '' }) {
  return <span className={`pill bg-white text-ok border-ok ${className}`.trim()}>{children}</span>;
}

export function NeutralPill({ children, className = '' }) {
  return <span className={`pill bg-white ${className}`.trim()}>{children}</span>;
}

export function FreePill({ className = '' }) {
  return <span className={`pill bg-locked ${className}`.trim()}>Free</span>;
}

export function PaidPill({ isPaid, className = '' }) {
  return isPaid ? (
    <ConfirmedPill className={className}>Paid</ConfirmedPill>
  ) : (
    <FreePill className={className} />
  );
}

export function AlertPill({ children, className = '' }) {
  return <span className={`pill border-alert bg-white text-alert ${className}`.trim()}>{children}</span>;
}
