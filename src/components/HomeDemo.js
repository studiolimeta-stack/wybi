'use client';

import { useState } from 'react';
import { OfferCard } from './OfferCard.js';

const DEMO_IMAGES = [
  '/brand/demo/sippod-bottle-1.webp',
  '/brand/demo/sippod-bottle-2.webp',
  '/brand/demo/sippod-bottle-3.webp',
  '/brand/demo/sippod-bottle-4.webp',
  '/brand/demo/sippod-bottle-5.webp',
];
const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

const DEMO_OFFER = {
  title: 'The SipPod Bottle',
  description: 'One bottle for hydration and the small essentials that keep you going. SipPod combines a premium insulated bottle with a detachable base pod for snacks, supplements, tea, or anything you’d rather not carry separately.',
  included_items: '700 ml insulated stainless-steel bottle\nDetachable 180 ml storage pod\nLeak-resistant flip drinking spout\nComfortable silicone grip\nFlexible carry loop\nDesigned for commuting, work and day trips',
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
        priceExtra={
          <>
            {step === 'ask' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className="btn btn-answer text-lg py-4" onClick={() => chooseAnswer('yes')}>
                  Yes, I&apos;d buy it
                </button>
                <button type="button" className="btn btn-answer text-lg py-4" onClick={() => chooseAnswer('no')}>
                  No, not at this price
                </button>
              </div>
            )}

            {step === 'confidence' && (
              <div>
                <h2 className="text-center text-lg font-extrabold tracking-tight">How serious are you?</h2>
                <div className="mt-3 grid gap-2">
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className="btn btn-plain flex-col items-start gap-0 pl-8 pr-5 py-2" onClick={finish}>
                      <span className="text-base font-extrabold">{option.label}</span>
                      <span className="text-sm font-normal text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-ghost mt-3 w-full text-sm" onClick={finish}>
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
              <div className="text-center">
                <p className="text-xl font-extrabold tracking-tight">Thanks — vote recorded.</p>
                <p className="hint mt-1">
                  {answer === 'yes' ? 'The creator sees the number, never your name.' : 'Honest answers are the useful ones.'}
                </p>
                <button type="button" className="btn-ghost mt-3 text-sm" onClick={reset}>
                  Try the demo again
                </button>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
