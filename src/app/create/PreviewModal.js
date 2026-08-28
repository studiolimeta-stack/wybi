'use client';

import { useState } from 'react';
import { OfferCard } from '../../components/OfferCard.js';

const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

/**
 * Preview mode (spec §4-5). Reuses `OfferCard` and the same
 * ask → confidence/suggest → done state machine as `HomeDemo`/`RespondFlow`
 * instead of a second visual implementation — the whole point is that a
 * creator sees exactly what a respondent will see.
 *
 * Fully local, no persistence: never calls `/api/respond`, never touches
 * `wybi_mine`, never generates a token. `offer`/`price` are just the
 * creator's current, unsaved form state — nothing here is written anywhere.
 */
export function PreviewModal({ offer, price, askConfidence, askSuggestedPrice, onClose }) {
  const [step, setStep] = useState('ask');
  const [answer, setAnswer] = useState(null);
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const symbol = offer.currency === 'EUR' ? '€' : offer.currency === 'GBP' ? '£' : '$';

  function chooseAnswer(value) {
    setAnswer(value);
    if (value === 'yes' && askConfidence) setStep('confidence');
    else if (value === 'no' && askSuggestedPrice) setStep('suggest');
    else setStep('done');
  }

  function finish() {
    setStep('done');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview test"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 py-8 sm:py-14"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-[#fff8f0] px-4 py-3">
          <p className="text-sm font-bold">Preview mode — responses won&apos;t be saved.</p>
          <button type="button" className="btn btn-plain px-3 py-2 text-sm" onClick={onClose}>
            Back to editing
          </button>
        </div>

        <OfferCard
          test={offer}
          price={price}
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
                      <button
                        key={option.value}
                        type="button"
                        className="btn btn-plain flex-col items-start gap-0 pl-8 pr-5 py-2"
                        onClick={finish}
                      >
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
                  <h2 className="text-center text-lg font-extrabold tracking-tight">
                    What would feel like a fair price?
                  </h2>
                  <form
                    className="mt-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      finish();
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{symbol}</span>
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
                </div>
              )}
            </>
          }
        />

        <button type="button" className="btn btn-plain mt-4 w-full sm:w-auto" onClick={onClose}>
          Back to editing
        </button>
      </div>
    </div>
  );
}
