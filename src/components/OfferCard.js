import { formatPrice } from '../lib/pricing.js';
import { CheckIcon } from './CheckIcon.js';
import { ProductImageGallery } from './ProductImageGallery.js';

/**
 * The offer as a respondent sees it. Deliberately one component so the
 * homepage demo, the live respondent page and the preview can never drift apart.
 */
export function OfferCard({ test, price, showPrice = true, priceExtra, children, className = '', titleClassName = '' }) {
  const storedImages = Array.isArray(test.image_urls) ? test.image_urls : [];
  const imageUrls = storedImages.length > 0 ? storedImages : test.image_url ? [test.image_url] : [];
  const items = (test.included_items || '')
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  return (
    <div className={`card overflow-hidden ${imageUrls.length ? 'p-5 sm:p-7 md:grid md:grid-cols-2 md:items-start md:gap-10' : ''} ${className}`}>
      {imageUrls.length > 0 && <ProductImageGallery images={imageUrls} presentations={test.image_presentations} />}

      <div className={imageUrls.length ? 'p-0 md:pt-1' : 'p-6 sm:p-8'}>
        <h1 className={`text-3xl font-extrabold tracking-tight ${titleClassName}`}>{test.title}</h1>
        <p className="mt-2 text-muted leading-relaxed">{test.description}</p>

        {items.length > 0 && (
          <div className="mt-5">
            <ul className="space-y-1">
              {items.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {test.product_url && (
          <a
            href={test.product_url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="mt-4 inline-block text-sm font-semibold underline"
          >
            Learn more
          </a>
        )}

        {showPrice && (
          <div className="mt-6 rounded-xl border-2 border-ink bg-[#f4f1ff] p-4">
            <p className="text-base font-bold text-ink">Would you buy {test.title} for</p>
            <p className="mt-1 text-5xl font-extrabold tracking-tight">
            {formatPrice(price, test.currency, test.billing_type)}
            </p>
            {/* Optional slot for the initial ask (question + yes/no buttons) so it
              * can live in the same box as the price it's asking about, instead of
              * as a disconnected block underneath — see HomeDemo. */}
            {priceExtra && <div className="mt-4 border-t border-ink/10 pt-4">{priceExtra}</div>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
