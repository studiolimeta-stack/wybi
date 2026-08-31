import { SiteFooter, SiteHeader } from './SiteChrome.js';

/** Keeps every admin surface full-height so its footer sits at the viewport edge on short pages. */
export function AdminShell({ children, mainClassName = 'wrap pt-6 pb-16' }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className={`flex-1 ${mainClassName}`}>{children}</main>
      <SiteFooter />
    </div>
  );
}
