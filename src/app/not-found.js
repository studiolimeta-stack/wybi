import Link from 'next/link';
import { SiteFooter } from '../components/SiteChrome.js';

export default function NotFound() {
  return (
    <>
      <main className="wrap py-24 text-center">
        <p className="text-5xl">🤷</p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">This link doesn&apos;t go anywhere.</h1>
        <p className="mt-2 text-muted">The test may have been deleted, or the link is mistyped.</p>
        <Link href="/create" className="btn btn-primary mt-7">
          Test your own product
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
