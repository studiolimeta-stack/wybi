'use client';

import { useEffect, useState } from 'react';
import { OfferCard } from '../../components/OfferCard.js';

const CONFIDENCE_OPTIONS = [
  { value: 'maybe', label: 'Maybe', hint: 'Sounds interesting.' },
  { value: 'probably', label: 'Probably', hint: 'I would seriously consider buying.' },
  { value: 'would_pay', label: "I'd actually pay", hint: 'I would buy at this price.' },
];

/**
 * Preview mode (spec §4-5). Must render *exactly* what a respondent sees on
 * `/t/[slug]` — same `.wrap` container (72rem), same heading pattern, same
 * `OfferCard` + ask/confidence/suggest/done steps `RespondFlow`/`HomeDemo`
 * use. Earlier versions of this component wrapped everything in an
 * additional `max-w-2xl` (42rem) container "for the modal" — that squeezed
 * OfferCard's two-column image/content grid and the yes/no button grid
 * inside it into roughly half the width the real page gives them, which is
 * why the pill-shaped `.btn-answer` buttons rendered as near-circles instead
 * of the real page's wide rectangles. `/t/[slug]/page.js` only ever applies
 * `max-w-2xl` to the *heading*, never to `OfferCard` itself — copy that
 * exactly, not a guessed-at modal width.
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

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    <div role="dialog" aria-modal="true" aria-label="Preview test" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      {/* Stands in for the site header the real /t/[slug] page never renders
        * (decision 9) — this is the one piece of chrome that's allowed to
        * differ from the real page, since it's what makes this a preview
        * and not a live link. */}
      <div className="sticky top-0 z-10 border-b-2 border-ink bg-locked">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm font-bold">Preview mode — responses won&apos;t be saved.</p>
          <button type="button" className="btn btn-plain px-3 py-2 text-sm" onClick={onClose}>
            Back to editing
          </button>
        </div>
      </div>

      <main className="wrap py-8 sm:py-14">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Would you buy {offer.title || 'this'}?
          </h1>
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
                  {/* Mirrors RespondFlow's post-answer placement (see OfferCard's
                    * docstring) — but a plain <a>, not <ProductLink>, on purpose:
                    * Preview must never fire a network call (decision 26, "nothing
                    * here is written anywhere"), and ProductLink's TrackedLink
                    * always POSTs to /api/events. */}
                  {offer.product_url && (
                    <a
                      href={offer.product_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="mt-3 inline-block text-sm font-semibold underline"
                    >
                      Learn more
                    </a>
                  )}
                </div>
              )}
            </>
          }
        />

        <p className="hint mt-8 text-center">
          <button type="button" className="underline" onClick={onClose}>
            Back to editing
          </button>
        </p>
      </main>
    </div>
  );
}
