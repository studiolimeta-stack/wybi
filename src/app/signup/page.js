import { redirect } from 'next/navigation';

// A separate route so external/marketing links to "/signup" resolve, even
// though it's the exact same screen as /login with the toggle pre-set —
// signup and login are functionally identical once both auth methods just
// create-or-sign-in on proof of the email address.
export default async function SignupRedirect({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams({ mode: 'signup', ...(params.next ? { next: params.next } : {}) });
  redirect(`/login?${qs.toString()}`);
}
