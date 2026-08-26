'use client';

import { useState } from 'react';

export function LoginForm({ mode, next }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);
  const [devLink, setDevLink] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      const res = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mode, next }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setStatus('idle');
        return;
      }

      setDevLink(data.devLink || null);
      setStatus('sent');
    } catch {
      setError('Could not reach the server. Try again.');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border-2 border-ink bg-locked p-4">
        <p className="font-bold">Check your email</p>
        <p className="hint mt-1">
          We sent a {mode === 'signup' ? 'confirmation' : 'login'} link to <strong>{email}</strong>. It works
          once and expires in 15 minutes.
        </p>

        {devLink && (
          <div className="mt-3 rounded-lg border-1.5 border-dashed border-ink bg-white p-3">
            <p className="pill mb-2 bg-white">Dev mode — email isn&apos;t connected yet</p>
            <a href={devLink} className="break-all text-sm font-semibold text-accent underline">
              {devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          className="field"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error && <p className="err">{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={status === 'sending'}>
        {status === 'sending'
          ? 'Sending…'
          : mode === 'signup'
            ? 'Send me a signup link'
            : 'Send me a login link'}
      </button>
    </form>
  );
}
