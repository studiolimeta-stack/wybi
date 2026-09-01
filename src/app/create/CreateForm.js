'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toThumbUrl } from '../../lib/images.js';
import { PreviewModal } from './PreviewModal.js';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const BILLING = [
  { value: 'one_time', label: 'One-time' },
  { value: 'per_month', label: 'Per month' },
  { value: 'per_year', label: 'Per year' },
];

const MAX_PRICES = 5;
const MAX_IMAGES = 5;

export function CreateForm() {
  const router = useRouter();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    includedItems: '',
    productUrl: '',
    currency: 'USD',
    billingType: 'one_time',
    askSuggestedPrice: true,
    askConfidence: true,
  });
  const [prices, setPrices] = useState(['', '']);
  const [imageUrls, setImageUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageWarning, setImageWarning] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrice, setPreviewPrice] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const symbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '$';
  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  function setPriceAt(index, value) {
    setPrices((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  /**
   * Preview has its own lightweight, client-only validation — it must never
   * reuse the real form's native/server validation path, since fields like
   * description are required to actually create a test but not to preview
   * one. Minimum bar: a name and at least one parseable price.
   */
  function openPreview() {
    const title = form.title.trim();
    let price = null;
    for (const raw of prices) {
      const amount = Number.parseFloat(String(raw).replace(',', '.'));
      if (Number.isFinite(amount) && amount > 0) {
        price = Math.round(amount * 100) / 100;
        break;
      }
    }

    if (title.length < 2 || price === null) {
      setPreviewError('Add a name and at least one price to preview.');
      return;
    }

    setPreviewError(null);
    setPreviewPrice(price);
    setPreviewOpen(true);
  }

  // Images are shown uncropped in a 4:3 frame (never cropped — a cut-off product
  // logo is worse than some padding). Only flag genuinely extreme ratios, where
  // that padding would be large enough to look like a mistake.
  function readAspectRatio(file) {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img.naturalWidth / img.naturalHeight);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(1);
      };
      img.src = url;
    });
  }

  async function addFiles(fileList) {
    const selectedFiles = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!selectedFiles.length) return;

    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      setErrors((prev) => ({ ...prev, images: `You can add up to ${MAX_IMAGES} images.` }));
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const files = selectedFiles.slice(0, remaining);

    setUploading(true);
    setErrors((prev) => ({ ...prev, images: selectedFiles.length > remaining ? `Only the first ${remaining} image${remaining === 1 ? '' : 's'} were added.` : null }));
    try {
      // Photos are shown in a 4:3 frame and never cropped, so anything
      // narrower than that pads on the sides — portrait photos worst of all
      // (a 3:4 photo only fills ~56% of the frame's width). Wide photos barely
      // pad at all, so that threshold stays loose.
      const ratios = await Promise.all(files.map(readAspectRatio));
      setImageWarning(
        ratios.some((ratio) => ratio < 0.85)
          ? 'Tall or portrait photos show with padding on the sides in the 4:3 frame — a landscape shot fills it better.'
          : ratios.some((ratio) => ratio > 2.2)
            ? 'Very wide photos show with a little padding top and bottom — they’re never cropped.'
            : null,
      );
      const uploadedImages = await Promise.all(
        files.map(async (file) => {
          const body = new FormData();
          body.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          return data.imageUrl;
        }),
      );
      setImageUrls((previous) => [...previous, ...uploadedImages]);
    } catch (err) {
      setErrors((prev) => ({ ...prev, images: err.message }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // The first image is always the "main" image shown to respondents —
  // reordering (by drag, or the "Make main" button) just moves an entry to index 0.
  function moveImage(fromIndex, toIndex) {
    setImageUrls((previous) => {
      if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= previous.length) return previous;
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imageUrls, prices: prices.filter((p) => String(p).trim()) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.errors || { form: data.error || 'Something went wrong.' });
        setSubmitting(false);
        return;
      }
      router.push(`/created/${data.creatorToken}`);
    } catch {
      setErrors({ form: 'Network error — please try again.' });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-extrabold tracking-tight">What are you selling?</h2>

        <div>
          <label className="label" htmlFor="title">
            Name
          </label>
          <input
            id="title"
            className="field"
            value={form.title}
            onChange={update('title')}
            placeholder="InvoiceAI Pro"
            maxLength={80}
            required
          />
          {errors.title && <p className="err">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field"
            rows={3}
            value={form.description}
            onChange={update('description')}
            placeholder="An invoicing tool for freelancers that automatically categorises expenses."
            maxLength={400}
            required
          />
          {errors.description && <p className="err">{errors.description}</p>}
        </div>

        <div>
          <label className="label" htmlFor="includedItems">
            What does the buyer get? <span className="hint font-normal">(optional)</span>
          </label>
          <textarea
            id="includedItems"
            className="field"
            rows={4}
            value={form.includedItems}
            onChange={update('includedItems')}
            placeholder={'Unlimited invoices\n5 users\nAI categorisation\nPDF export'}
            maxLength={600}
          />
          <p className="hint mt-1">One per line.</p>
        </div>

        <div>
          <label className="label" htmlFor="image">
            Product images <span className="hint font-normal">(optional, up to {MAX_IMAGES})</span>
          </label>

          {imageUrls.length < MAX_IMAGES && (
            <div
              role="button"
              tabIndex={0}
              aria-disabled={uploading}
              onClick={() => !uploading && fileRef.current?.click()}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !uploading) {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!uploading) setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                if (!uploading) addFiles(event.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dropActive ? 'border-ink bg-[#f4f1ff]' : 'border-line'
              } ${uploading ? 'cursor-default opacity-60' : 'cursor-pointer hover:border-ink'}`}
            >
              <span className="text-sm font-bold">{uploading ? 'Uploading…' : 'Click or drag images here'}</span>
              <span className="hint">
                JPG, PNG or WEBP · up to {MAX_IMAGES - imageUrls.length} more
              </span>
              <input
                id="image"
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(event) => addFiles(event.target.files)}
                className="hidden"
              />
            </div>
          )}

          <p className="hint mt-2">
            Images are shown in full, never cropped. The first image is the main image respondents see — drag a
            thumbnail to reorder, or tap the ★ on any image to make it the main one.
          </p>
          {imageWarning && <p className="hint mt-1 text-amber-700">{imageWarning}</p>}
          {errors.images && <p className="err">{errors.images}</p>}

          {imageUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {imageUrls.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null) moveImage(draggedIndex, index);
                    setDraggedIndex(null);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  className={`relative cursor-grab active:cursor-grabbing ${draggedIndex === index ? 'opacity-40' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* This grid is a management view (reorder / remove / pick main), not
                    * the respondent's view — respondents always see the full, uncropped
                    * photo in the 4:3 frame. A small square crop here keeps this row uniform. */}
                  <img
                    src={toThumbUrl(imageUrl)}
                    alt=""
                    className="aspect-square w-full rounded-lg border-2 border-ink object-cover"
                  />
                  {/* Just marks the primary photo — not a paywall/inactive
                    * state, so it doesn't wear that tint (`bg-locked`). */}
                  {index === 0 ? (
                    <span className="pill bg-white absolute left-1.5 top-1.5 px-2 py-1 text-xs">Main</span>
                  ) : (
                    <button
                      type="button"
                      className="absolute bottom-1.5 left-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-base leading-none shadow-sm"
                      title="Make main image"
                      aria-label="Make main image"
                      onClick={() => moveImage(index, 0)}
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-lg font-bold leading-none shadow-sm"
                    title="Remove image"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => setImageUrls((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="productUrl">
            Product link <span className="hint font-normal">(optional)</span>
          </label>
          <input
            id="productUrl"
            className="field"
            value={form.productUrl}
            onChange={update('productUrl')}
            placeholder="https://myproduct.com"
            maxLength={500}
          />
          {errors.productUrl && <p className="err">{errors.productUrl}</p>}
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-extrabold tracking-tight">Prices to test</h2>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <select id="currency" className="field" value={form.currency} onChange={update('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="billingType">
              Billing
            </label>
            <select id="billingType" className="field" value={form.billingType} onChange={update('billingType')}>
              {BILLING.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {prices.map((price, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-6 text-lg font-bold">{symbol}</span>
              <input
                className="field"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPriceAt(index, e.target.value)}
                placeholder={['19', '29', '39', '49', '59'][index]}
                aria-label={`Price ${index + 1}`}
              />
              {prices.length > 1 && (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => setPrices((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove price ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {prices.length < MAX_PRICES && (
            <button type="button" className="btn-ghost text-sm" onClick={() => setPrices((prev) => [...prev, ''])}>
              + Add another price
            </button>
          )}
          {errors.prices && <p className="err">{errors.prices}</p>}
          <p className="hint">
            Each respondent sees only one of these, chosen at random. They never see the others.
          </p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight">Follow-up questions</h2>

        <label className="flex gap-3 items-start cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0"
            checked={form.askConfidence}
            onChange={update('askConfidence')}
          />
          <span>
            <span className="font-bold">Ask how serious they are</span>
            <span className="hint block">
              After a yes: maybe / probably / I&apos;d actually pay. This shows how strong the yeses are.
            </span>
          </span>
        </label>

        <label className="flex gap-3 items-start cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0"
            checked={form.askSuggestedPrice}
            onChange={update('askSuggestedPrice')}
          />
          <span>
            <span className="font-bold">Ask what they would pay</span>
            <span className="hint block">After a no: &ldquo;What would feel like a fair price?&rdquo;</span>
          </span>
        </label>
      </div>

      {errors.form && <p className="err">{errors.form}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn btn-plain w-full text-lg sm:w-auto sm:flex-1"
          onClick={openPreview}
          disabled={submitting}
        >
          Preview test
        </button>
        <button
          type="submit"
          className="btn btn-primary w-full text-lg sm:flex-1"
          disabled={submitting || uploading}
        >
          {submitting ? 'Creating…' : 'Create my test'}
        </button>
      </div>
      {previewError && <p className="err text-center">{previewError}</p>}

      {previewOpen && (
        <PreviewModal
          offer={{
            title: form.title,
            description: form.description,
            included_items: form.includedItems,
            product_url: form.productUrl,
            currency: form.currency,
            billing_type: form.billingType,
            image_urls: imageUrls,
          }}
          price={previewPrice}
          askConfidence={form.askConfidence}
          askSuggestedPrice={form.askSuggestedPrice}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </form>
  );
}
