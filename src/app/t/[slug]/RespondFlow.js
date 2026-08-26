'use client';

import { useState } from 'react';
import { TrackedLink } from '../../../components/Track.js';

const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

/**
 * Steps: ask → (confidence | suggested price) → done.
 * The yes/no is POSTed the instant it is clicked; the follow-up PATCHes on top.
 */
export function RespondFlow({ slug, currencySymbol, askConfidence, askSuggestedPrice }) {
  const [step, setStep] = useState('ask');
  const [answer, setAnswer] = useState(null);
  const [suggested, setSuggested] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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
        body: JSON.stringify({ slug, answer: value, ...trackingPayload() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not record your answer.');
        setBusy(false);
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

  if (step === 'ask') {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-extrabold tracking-tight">Would you actually buy this?</h2>

        {/*
          * Both options carry identical styling on purpose — see .btn-answer in
          * globals.css. Colouring one green and one red biases the sample, and
          * the sample is the product. The tick/cross glyphs are gone for the
          * same reason: a cross reads as "wrong", not "no".
          */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-answer text-lg py-4" disabled={busy} onClick={() => chooseAnswer('yes')}>
            Yes, I&apos;d buy it
          </button>
          <button type="button" className="btn btn-answer text-lg py-4" disabled={busy} onClick={() => chooseAnswer('no')}>
            No, not at this price
          </button>
        </div>

        {error && <p className="err text-center mt-3">{error}</p>}
      </div>
    );
  }

  if (step === 'confidence') {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-extrabold tracking-tight text-center">How serious are you?</h2>
        <div className="mt-5 grid gap-2">
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
        <button type="button" className="btn-ghost mt-4 w-full text-sm" onClick={() => sendFollowUp({})}>
          Skip
        </button>
      </div>
    );
  }

  if (step === 'suggest') {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-extrabold tracking-tight text-center">What would feel like a fair price?</h2>
        <form
          className="mt-5"
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
        <button type="button" className="btn-ghost mt-3 w-full text-sm" onClick={() => sendFollowUp({})}>
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 text-center">
      <p className="text-2xl font-extrabold tracking-tight">Thanks — vote recorded.</p>
      <p className="hint mt-1">
        {answer === 'yes' ? 'The creator sees the number, never your name.' : 'Honest answers are the useful ones.'}
      </p>

      {/* This is the entire viral loop (PRD §35), and until now clicking it
        * recorded nothing — so "did a respondent go on to create their own
        * test?", one of the V1 success criteria, was unanswerable. */}
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
    </div>
  );
}
