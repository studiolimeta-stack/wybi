'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

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
    email: '',
  });
  const [prices, setPrices] = useState(['', '']);
  const [imageUrls, setImageUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const symbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '$';
  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  function setPriceAt(index, value) {
    setPrices((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function handleImages(event) {
    const selectedFiles = Array.from(event.target.files || []);
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
          <input
            id="image"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading || imageUrls.length >= MAX_IMAGES}
            onChange={handleImages}
            className="field"
          />
          {uploading && <p className="hint mt-1">Uploading…</p>}
          <p className="hint mt-1">Add up to {MAX_IMAGES} JPG, PNG or WEBP images. The first image is shown first.</p>
          {imageUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {imageUrls.map((imageUrl, index) => (
                <div key={imageUrl} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="aspect-square w-full rounded-lg border-2 border-ink object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => setImageUrls((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors.images && <p className="err">{errors.images}</p>}
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

      <div className="card p-6">
        <label className="label" htmlFor="email">
          Your email <span className="hint font-normal">(optional)</span>
        </label>
        <input
          id="email"
          type="email"
          className="field"
          value={form.email}
          onChange={update('email')}
          placeholder="you@example.com"
          maxLength={200}
        />
        <p className="hint mt-1">
          Only used to recover your results link. We never show it to respondents and never email you
          anything else.
        </p>
        {errors.email && <p className="err">{errors.email}</p>}
      </div>

      {errors.form && <p className="err">{errors.form}</p>}

      <button type="submit" className="btn btn-primary w-full text-lg" disabled={submitting || uploading}>
        {submitting ? 'Creating…' : 'Create my test'}
      </button>
    </form>
  );
}
