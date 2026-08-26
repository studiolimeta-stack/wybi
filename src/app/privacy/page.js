import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LegalPage } from '../../components/LegalPage.js';

export const metadata = { title: 'Privacy Policy — Would You Buy It?' };

const UPDATED = 'August 26, 2026';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage title="Privacy Policy" updated={UPDATED}>
        <p>
          Would You Buy It? (&ldquo;WYBI&rdquo;, &ldquo;we&rdquo;) is a pricing-research tool: a creator describes an
          offer and up to five prices, and people who visit the shareable link each see exactly one of those prices
          and say yes or no. This page explains what we collect, from whom, and why.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>Answering a price test doesn&apos;t require a name, email, or account.</li>
          <li>A test creator never sees who answered what — only aggregated numbers per price.</li>
          <li>We don&apos;t sell data, run ads, or use third-party analytics or ad trackers.</li>
          <li>There is no AI anywhere in this product, and none of your data is used to train one.</li>
        </ul>

        <h2>If you&apos;re answering a price test</h2>
        <p>
          We don&apos;t ask for your name or email to answer. We set one anonymous cookie on your browser so the
          same person can&apos;t vote twice on the same test — see the{' '}
          <Link href="/cookies">Cookie Policy</Link> for exactly what it stores. We record your yes/no answer, the
          price you were shown, and, if you choose to give them, an optional confidence level and an optional
          price suggestion. None of that is linked to your name or email, because we never collect one.
        </p>
        <p>
          The test creator&apos;s report is aggregated statistics — purchase-intent rates, modelled revenue, that
          kind of thing — not a list of individual answers. Even the CSV export a creator can download deliberately
          leaves out any per-respondent identifier.
        </p>

        <h2>If you&apos;re creating an account or a test</h2>
        <p>You can create and share a price test without an account. Creating an account (to save tests to a
          dashboard, unlock a report, or manage billing) collects:
        </p>
        <ul>
          <li>
            <strong>Your email address</strong>, from Google sign-in or from clicking a magic link we send you.
          </li>
          <li>
            <strong>The offers and prices you create</strong> — title, description, images, and price points.
          </li>
          <li>
            <strong>Payment records</strong> when you unlock a report — the amount, date, and status of the charge.
            We never see or store your card number; that&apos;s handled entirely by our payment processor, Stripe.
          </li>
        </ul>

        <h2>Who we share data with</h2>
        <p>We use a small number of third-party services to run WYBI, and only for the purpose named:</p>
        <ul>
          <li><strong>Google</strong> — if you choose to sign in with Google, to verify your identity.</li>
          <li>
            <strong>Stripe</strong> — to process payment when you unlock a report. Stripe handles your card details
            directly; we never receive or store them.
          </li>
          <li>
            <strong>Our transactional email provider</strong> — to send sign-in links, if you sign in by email
            instead of Google.
          </li>
        </ul>
        <p>
          We do not sell personal data to anyone, and we do not use third-party advertising or analytics trackers.
          Basic product analytics (which pages get used, which steps people drop off at) is first-party, stored in
          our own database, and used only to improve the product.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account data is kept for as long as your account is active. You can delete your account at any time from{' '}
          <Link href="/account">your account page</Link> — this immediately removes your sign-in identities and
          ends every active session. Tests you created and payment records are retained after that (disassociated
          from your account) for accounting and product-integrity reasons, the same way a receipt outlives a closed
          store account.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Delete your account and sign-in data any time from <Link href="/account">Account</Link>.</li>
          <li>Sign out of every device at once from the same page.</li>
          <li>Clear the anonymous respondent cookie any time via your browser&apos;s cookie settings.</li>
        </ul>

        <h2>Questions</h2>
        <p>
          Reach us at <a href="mailto:studiolimeta@gmail.com">studiolimeta@gmail.com</a> for anything about this
          policy or your data.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
