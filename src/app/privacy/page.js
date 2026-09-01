import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LegalPage } from '../../components/LegalPage.js';

export const metadata = { title: 'Privacy Policy — Would You Buy It?' };

const UPDATED = 'September 1, 2026';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage title="Privacy Policy" updated={UPDATED}>
        <p>
          Would You Buy It? (&ldquo;WYBY&rdquo;, &ldquo;we&rdquo;) is a pricing-research tool: a creator describes an
          offer and up to five prices, and people who visit the shareable link each see exactly one of those prices
          and say yes or no. This page explains what we collect, from whom, and why.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>Answering a price test doesn&apos;t require a name, email, or account.</li>
          <li>A test creator never sees who answered what — only aggregated numbers per price.</li>
          <li>We don&apos;t sell data, run ads, or use advertising or marketing trackers of any kind.</li>
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
        <p>
          We also record a few technical signals to keep results trustworthy and catch abuse: a coarse device
          category (mobile, tablet, or desktop — not your exact browser or device), and, if present, where the link
          was shared from (a referring page or campaign tag). We never store your IP address itself — only a
          one-way, salted hash of it (see &ldquo;Keeping results honest&rdquo; below). None of this is shown to the
          test creator; it&apos;s visible only in our own internal dashboard, used to run the product, never sold or
          shared.
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
            We never see or store your card number, billing address, or tax details; the payment itself is sold
            and billed by Paddle as merchant of record (see below).
          </li>
        </ul>

        <h2>Who we share data with</h2>
        <p>We use a small number of third-party services to run WYBY, and only for the purpose named:</p>
        <ul>
          <li><strong>Google</strong> — if you choose to sign in with Google, to verify your identity.</li>
          <li>
            <strong>Paddle</strong> — our <strong>Merchant of Record</strong>. When you unlock a report, Paddle is
            the seller of that transaction, not just a processor passing a card number through: it collects your
            payment details and the billing information it needs to charge the right VAT or sales tax for your
            country, issues the invoice, and is the controller of that payment data under its own{' '}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              privacy policy
            </a>
            . We never receive or store your card details — only a record that the payment succeeded, plus the
            amount, date, and status.
          </li>
          <li>
            <strong>Our transactional email provider</strong> — to send sign-in links, if you sign in by email
            instead of Google.
          </li>
          <li>
            <strong>Cloudflare (Turnstile)</strong> — an invisible bot-check on the voting page, so a test&apos;s
            results reflect real people rather than automated scripts. Cloudflare&apos;s widget runs in your
            browser, and when you vote we send it a one-time verification token together with your IP address to
            confirm you&apos;re not a bot — see{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
              Cloudflare&apos;s privacy policy
            </a>
            . It never shows a checkbox or interrupts you if it can verify you silently.
          </li>
        </ul>
        <p>
          We do not sell personal data to anyone, and we do not use third-party advertising or marketing trackers.
          Product usage analytics happens two ways: detailed funnel events (which step of the flow people reach,
          results-page views, that kind of thing) are stored first-party in our own database; and general site
          traffic (page views, referrers, browser/device mix) is measured with{' '}
          <a href="https://umami.is" target="_blank" rel="noopener noreferrer">
            Umami
          </a>
          , an open-source analytics tool we run ourselves on our own server — it&apos;s cookieless, uses no
          persistent identifier, and never sends your data to an outside analytics company.
        </p>

        <h2>Keeping results honest</h2>
        <p>
          To stop the same person voting twice on a test or abusing sign-in/upload endpoints, we compute a
          one-way, salted hash (SHA-256) of your IP address and use that hash for rate-limiting and duplicate-vote
          checks. Your actual IP address is never written to our database — only this hash, which can&apos;t be
          reversed back into an address, and which we never show to test creators. Logged-in sessions store the
          same hash, alongside your browser&apos;s user-agent string, purely for account security (recognising
          anomalous activity) and to support &ldquo;Log out everywhere&rdquo; from{' '}
          <Link href="/account">Account</Link>.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account data is kept for as long as your account is active. You can delete your account at any time from{' '}
          <Link href="/account">your account page</Link> — this immediately removes your sign-in identities and
          ends every active session. Tests you created and payment records are retained after that (disassociated
          from your account) for accounting and product-integrity reasons, the same way a receipt outlives a closed
          store account.
        </p>
        <p>
          Answers to a price test (and the anonymised traffic data behind stats like &ldquo;answer rate&rdquo;) are
          kept for as long as the test itself exists, since they&apos;re what the creator&apos;s pricing report is
          built from — that&apos;s the whole product. Deleting a test deletes its answers and traffic data with it,
          immediately and permanently. Sign-in sessions and magic-link emails are single-purpose and short-lived by
          design (a session expires after 30 days of inactivity, a login link after 15 minutes) and are automatically
          erased from our database roughly a month after they stop being usable, whether or not you ever delete
          your account.
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
