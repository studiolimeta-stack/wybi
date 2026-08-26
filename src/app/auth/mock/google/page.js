import { redirect } from 'next/navigation';
import { config } from '../../../../lib/config.js';
import { safeRedirect } from '../../../../lib/auth.js';

export const metadata = { title: 'Continue with Google (dev)', robots: { index: false, follow: false } };

const PRESETS = [
  { label: 'Ava — new user', name: 'Ava Rousseau', email: 'ava.rousseau@example.com' },
  { label: 'Sam — returning user', name: 'Sam Okafor', email: 'sam.okafor@example.com' },
];

/**
 * Stands in for Google's consent screen while `GOOGLE_CLIENT_ID` /
 * `GOOGLE_CLIENT_SECRET` are unset. Deliberately unmissable as a dev surface —
 * amber banner, explicit "isn't connected yet" copy — so nobody mistakes it
 * for the real thing once it is briefly live during testing.
 */
export default async function MockGooglePage({ searchParams }) {
  const params = await searchParams;
  const next = safeRedirect(params.next);
  const mode = params.mode === 'signup' ? 'signup' : 'login';

  // Once real credentials exist this page has no reason to be reachable —
  // send straight into the real flow instead of leaving two live paths.
  if (config.google.enabled) {
    redirect(`/api/auth/google/start?next=${encodeURIComponent(next)}&mode=${mode}`);
  }

  return (
    <main className="wrap py-16">
      <div className="mx-auto max-w-md">
        <div className="pill bg-locked border-none mb-4">Development mode</div>
        <div className="card p-6">
          <h1 className="text-xl font-extrabold tracking-tight">Continue with Google</h1>
          <p className="hint mt-2">
            Google sign-in isn&apos;t connected yet. Pick a test identity below — it runs through the exact
            same account logic a real Google login would.
          </p>

          <form action="/api/auth/mock/google" method="POST" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />

            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className="field" defaultValue="Test User" required />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field"
                defaultValue="test@example.com"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full">
              Continue as this test user
            </button>
          </form>

          <div className="mt-5 border-t border-line pt-4">
            <p className="hint mb-2">Or jump straight in as:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <form key={preset.email} action="/api/auth/mock/google" method="POST">
                  <input type="hidden" name="next" value={next} />
                  <input type="hidden" name="name" value={preset.name} />
                  <input type="hidden" name="email" value={preset.email} />
                  <button type="submit" className="pill hover:bg-locked">
                    {preset.label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
