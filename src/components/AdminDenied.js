import Link from 'next/link';
import { SiteHeader, SiteFooter } from './SiteChrome.js';

/** Shared by every /admin/* page — one copy of the login/denied screen instead of four that could drift. */
export function AdminDenied({ user }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        {user ? (
          <p className="mt-2 text-muted">
            Signed in as <strong>{user.email}</strong>, but that account isn&apos;t on the admin list.
          </p>
        ) : (
          <>
            <p className="mt-2 text-muted">Log in with an admin account to see this page.</p>
            <Link href="/login?next=/admin" className="btn btn-primary mt-4 inline-block">
              Log in
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
