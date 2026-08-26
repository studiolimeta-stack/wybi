'use client';

import { useState } from 'react';
import { OfferCard } from './OfferCard.js';

const DEMO_IMAGES = [
  '/brand/demo/sunday-reset-kit-1.webp',
  '/brand/demo/sunday-reset-kit-2.webp',
  '/brand/demo/sunday-reset-kit-3.webp',
  '/brand/demo/sunday-reset-kit-4.webp',
  '/brand/demo/sunday-reset-kit-5.webp',
];
const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

const DEMO_OFFER = {
  title: 'The Sunday Reset Kit',
  description: 'A beautifully designed weekly planning kit that helps you clear your head, organize your priorities, and build better habits—so you can start every Monday feeling calmer, more focused, and ready for the week ahead.',
  included_items: 'A tactile weekly planning kit for a calmer, more focused Monday.\nUndated weekly planner\n60-minute focus timer\nFour habit-tracker cards\nSteel pen and gift-ready box\nFree shipping',
  currency: 'USD',
  billing_type: 'one_time',
  image_urls: DEMO_IMAGES,
};

/** Mirrors the respondent flow, including the follow-up questions after a vote. */
export function HomeDemo() {
  const [step, setStep] = useState('ask');
  const [answer, setAnswer] = useState(null);
  const [suggestedPrice, setSuggestedPrice] = useState('');

  function chooseAnswer(value) {
    setAnswer(value);
    setStep(value === 'yes' ? 'confidence' : 'suggest');
  }

  function finish() {
    setStep('done');
  }

  function reset() {
    setAnswer(null);
    setSuggestedPrice('');
    setStep('ask');
  }

  return (
    <div id="demo-offer-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <span className="pill bg-locked">Live demo</span>
        <span className="text-xs font-bold text-muted">Try the full respondent flow</span>
      </div>

      <OfferCard
        test={DEMO_OFFER}
        price={34}
        titleClassName="pt-4 pb-2 md:pt-0 md:pb-0"
        className="border-none shadow-[0_8px_24px_rgba(30,35,64,0.06)]"
      >
        {step === 'ask' && (
          <div className="mt-6">
            <h2 className="text-xl font-extrabold tracking-tight">Would you actually buy this?</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn btn-answer text-lg py-4" onClick={() => chooseAnswer('yes')}>
                Yes, I&apos;d buy it
              </button>
              <button type="button" className="btn btn-answer text-lg py-4" onClick={() => chooseAnswer('no')}>
                No, not at this price
              </button>
            </div>
          </div>
        )}

        {step === 'confidence' && (
          <div className="mt-6">
            <h2 className="text-center text-xl font-extrabold tracking-tight">How serious are you?</h2>
            <div className="mt-5 grid gap-2">
              {CONFIDENCE_OPTIONS.map((option) => (
                <button key={option.value} type="button" className="btn btn-plain flex-col items-start gap-0 pl-8 pr-5 py-2" onClick={finish}>
                  <span className="text-base font-extrabold">{option.label}</span>
                  <span className="text-sm font-normal text-muted">{option.hint}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost mt-4 w-full text-sm" onClick={finish}>
              Skip
            </button>
          </div>
        )}

        {step === 'suggest' && (
          <div className="mt-6">
            <h2 className="text-center text-xl font-extrabold tracking-tight">What would feel like a fair price?</h2>
            <form
              className="mt-5"
              onSubmit={(event) => {
                event.preventDefault();
                finish();
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">$</span>
                <input
                  className="field text-lg"
                  inputMode="decimal"
                  value={suggestedPrice}
                  onChange={(event) => setSuggestedPrice(event.target.value)}
                  placeholder="0"
                  autoFocus
                  aria-label="Fair price"
                />
              </div>
              <button type="submit" className="btn btn-primary mt-4 w-full" disabled={!suggestedPrice.trim()}>
                Submit
              </button>
            </form>
            <button type="button" className="btn-ghost mt-3 w-full text-sm" onClick={finish}>
              Skip
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="mt-6 text-center">
            <p className="text-2xl font-extrabold tracking-tight">Thanks — vote recorded.</p>
            <p className="hint mt-1">
              {answer === 'yes' ? 'The creator sees the number, never your name.' : 'Honest answers are the useful ones.'}
            </p>
            <button type="button" className="btn-ghost mt-4 text-sm" onClick={reset}>
              Try the demo again
            </button>
          </div>
        )}
      </OfferCard>
    </div>
  );
}
