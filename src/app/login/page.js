import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LoginForm } from './LoginForm.js';
import { currentUser } from '../../lib/session.js';
import { safeRedirect } from '../../lib/auth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log in', robots: { index: false, follow: false } };

const ERRORS = {
  oauth_failed: 'Google sign-in didn’t go through. Please try again.',
  email_unverified: 'That Google account’s email isn’t verified, so we can’t use it.',
  expired_link: 'That link has expired or was already used. Request a new one below.',
  invalid_email: 'That email did not look right.',
  banned: 'This account has been suspended.',
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeRedirect(params.next);
  const mode = params.mode === 'signup' ? 'signup' : 'login';

  const user = await currentUser();
  if (user) redirect(next);

  const errorMessage = ERRORS[params.error] || null;

  return (
    <>
      <SiteHeader />
      <main className="wrap inner-page pb-16">
        <div className="mx-auto max-w-md">
          <div className="flex rounded-full border-2 border-ink bg-white p-1">
            <Link
              href={`/login?mode=login&next=${encodeURIComponent(next)}`}
              className={`flex-1 rounded-full py-2 text-center text-sm font-bold transition-colors ${
                mode === 'login' ? 'bg-ink text-white' : 'text-muted'
              }`}
            >
              Log in
            </Link>
            <Link
              href={`/login?mode=signup&next=${encodeURIComponent(next)}`}
              className={`flex-1 rounded-full py-2 text-center text-sm font-bold transition-colors ${
                mode === 'signup' ? 'bg-ink text-white' : 'text-muted'
              }`}
            >
              Sign up
            </Link>
          </div>

          <div className="card mt-5 p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="hint mt-1">
              You don&apos;t need an account to create a pricing test. Sign in to keep your tests together and
              access them across devices.
            </p>

            {errorMessage && (
              <p className="err mt-4 rounded-lg bg-locked px-3 py-2">{errorMessage}</p>
            )}

            <a
              href={`/api/auth/google/start?mode=${mode}&next=${encodeURIComponent(next)}`}
              className="btn btn-plain mt-6 w-full"
            >
              <GoogleIcon /> Continue with Google
            </a>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <LoginForm mode={mode} next={next} />

            {mode === 'signup' && (
              <p className="hint mt-5">
                By continuing you agree to our{' '}
                <Link href="/terms" className="underline">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}
