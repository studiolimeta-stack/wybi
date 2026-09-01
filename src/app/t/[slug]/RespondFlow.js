'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { OfferCard } from '../../../components/OfferCard.js';
import { TrackedLink } from '../../../components/Track.js';

const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

/**
 * Steps: ask → (confidence | suggested price) → done.
 * The yes/no is POSTed the instant it is clicked; the follow-up PATCHes on top.
 *
 * Owns the OfferCard (rather than being passed to it as children) so the
 * ask/confidence/suggest/done steps can render inside the price box via
 * `priceExtra` — exactly like HomeDemo — instead of as a disconnected block
 * underneath. Only the post-vote viral CTA lives outside the box, as a
 * sibling card, since it isn't part of the question itself.
 */
export function RespondFlow({ test, price, slug, currencySymbol, askConfidence, askSuggestedPrice, turnstileSiteKey = null }) {
  const [step, setStep] = useState('ask');
  const [answer, setAnswer] = useState(null);
  const [suggested, setSuggested] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Invisible Turnstile widget. Renders into `turnstileRef` the moment the
  // Cloudflare script (loaded by the page, see t/[slug]/page.js) is ready,
  // then hands a fresh token to `callback` on its own — no visible UI unless
  // Cloudflare decides it needs an interactive challenge, which is rare and
  // is exactly what the empty container below exists to hold.
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState(null);

  useEffect(() => {
    if (!turnstileSiteKey) return undefined;
    let cancelled = false;

    function tryRender(attemptsLeft) {
      if (cancelled || widgetIdRef.current !== null) return;
      if (window.turnstile && turnstileRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          size: 'invisible',
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
          'error-callback': () => setTurnstileToken(null),
        });
        return;
      }
      // The Cloudflare script loads async (next/script "afterInteractive"),
      // so it may not be on window yet on first render. Poll briefly rather
      // than block the page on it.
      if (attemptsLeft > 0) setTimeout(() => tryRender(attemptsLeft - 1), 100);
    }

    tryRender(50); // ~5s ceiling

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
  }, [turnstileSiteKey]);

  function trackingPayload() {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      referrer: document.referrer || null,
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
    };
  }

  async function chooseAnswer(value) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, answer: value, turnstileToken, ...trackingPayload() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not record your answer.');
        setBusy(false);
        // Turnstile tokens are single-use — get a fresh one queued up before
        // the visitor retries, otherwise a second click would fail the same way.
        if (widgetIdRef.current !== null && window.turnstile) {
          setTurnstileToken(null);
          window.turnstile.reset(widgetIdRef.current);
        }
        return;
      }

      setAnswer(value);
      if (value === 'yes' && askConfidence) setStep('confidence');
      else if (value === 'no' && askSuggestedPrice) setStep('suggest');
      else setStep('done');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendFollowUp(payload) {
    setBusy(true);
    try {
      await fetch('/api/respond', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...payload }),
      });
    } catch {
      // The vote is already safely recorded; a lost follow-up is not worth an error screen.
    } finally {
      setBusy(false);
      setStep('done');
    }
  }

  /**
   * The lightweight, respondent-side half of the viral loop — separate from
   * the "Test yours in 30 seconds" CTA below, which is the creator-recruiting
   * loop (PRD §35, tracked as `viral_cta_clicked`). This one lets someone who
   * just answered bring in the next respondent, which is a different action
   * worth its own event so the two loops don't get blended in /admin.
   *
   * Always points at the plain `/t/[slug]` URL this respondent is already
   * on — never `window.location.href` as-is, which could be carrying this
   * visitor's own utm/referrer params forward and misattributing the next
   * respondent's traffic to whatever brought this one in.
   */
  async function shareTest() {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'respondent_share_clicked', slug }),
      keepalive: true,
    }).catch(() => {});

    const shareUrl = `${window.location.origin}/t/${slug}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Would you buy ${test.title}?`, url: shareUrl });
      } catch {
        // Dismissing the system share sheet is a normal outcome, not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard API is blocked in some in-app browsers — nothing else to fall back to here.
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <>
      <OfferCard
        test={test}
        price={price}
        priceExtra={
          <>
            {step === 'ask' && (
              <div>
                {/*
                  * Both options carry identical styling on purpose — see .btn-answer in
                  * globals.css. Colouring one green and one red biases the sample, and
                  * the sample is the product. The tick/cross glyphs are gone for the
                  * same reason: a cross reads as "wrong", not "no".
                  */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" className="btn btn-answer text-lg py-4" disabled={busy} onClick={() => chooseAnswer('yes')}>
                    Yes, I&apos;d buy it
                  </button>
                  <button type="button" className="btn btn-answer text-lg py-4" disabled={busy} onClick={() => chooseAnswer('no')}>
                    No, not at this price
                  </button>
                </div>

                {error && <p className="err text-center mt-3">{error}</p>}

                {/* Empty unless Cloudflare needs to show an interactive challenge —
                  * rare, and not styled/hidden away because that's exactly when it
                  * needs to be visible and clickable. */}
                {turnstileSiteKey && <div ref={turnstileRef} />}
              </div>
            )}

            {step === 'confidence' && (
              <div>
                <h2 className="text-center text-lg font-extrabold tracking-tight">How serious are you?</h2>
                <div className="mt-3 grid gap-2">
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="btn btn-plain flex-col items-start gap-0 pl-8 pr-5 py-2"
                      disabled={busy}
                      onClick={() => sendFollowUp({ confidence: option.value })}
                    >
                      <span className="text-base font-extrabold">{option.label}</span>
                      <span className="text-sm font-normal text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-ghost mt-3 w-full text-sm" disabled={busy} onClick={() => sendFollowUp({})}>
                  Skip
                </button>
              </div>
            )}

            {step === 'suggest' && (
              <div>
                <h2 className="text-center text-lg font-extrabold tracking-tight">What would feel like a fair price?</h2>
                <form
                  className="mt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendFollowUp({ suggestedPrice: suggested });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{currencySymbol}</span>
                    <input
                      className="field text-lg"
                      inputMode="decimal"
                      value={suggested}
                      onChange={(event) => setSuggested(event.target.value)}
                      placeholder="0"
                      autoFocus
                      aria-label="Fair price"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !suggested.trim()}>
                    Submit
                  </button>
                </form>
                <button type="button" className="btn-ghost mt-3 w-full text-sm" disabled={busy} onClick={() => sendFollowUp({})}>
                  Skip
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center">
                <p className="text-xl font-extrabold tracking-tight">Thanks — vote recorded.</p>
                <p className="hint mt-1">
                  {answer === 'yes' ? 'The creator sees the number, never your name.' : 'Honest answers are the useful ones.'}
                </p>

                {/* Deliberately small and plain — a second, unrelated action sitting
                  * right under the vote confirmation must never compete with the real
                  * CTA card below it (decision 9: nothing here should read as a sell). */}
                <div className="mt-4 border-t border-line pt-3">
                  <p className="hint">Know someone whose opinion would be useful?</p>
                  <button
                    type="button"
                    className="btn-ghost mt-1 inline-flex items-center gap-1.5 text-sm"
                    onClick={shareTest}
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {linkCopied ? 'Link copied' : 'Share this test'}
                  </button>
                </div>
              </div>
            )}
          </>
        }
      />

      {step === 'done' && (
        // This is the entire viral loop (PRD §35), and until now clicking it
        // recorded nothing — so "did a respondent go on to create their own
        // test?", one of the V1 success criteria, was unanswerable.
        <div className="card mt-7 p-6">
          <p className="font-semibold">Have something you&apos;re thinking of selling?</p>
          <TrackedLink
            event="viral_cta_clicked"
            slug={slug}
            href={`/create?ref=${encodeURIComponent(slug)}`}
            className="btn btn-primary mt-4 w-full"
          >
            Test yours in 30 seconds
          </TrackedLink>
        </div>
      )}
    </>
  );
}
