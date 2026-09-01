import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LegalPage } from '../../components/LegalPage.js';
import { config } from '../../lib/config.js';

export const metadata = { title: 'Terms of Service — Would You Buy It?' };

const UPDATED = 'September 1, 2026';

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage title="Terms of Service" updated={UPDATED}>
        <p>
          These terms cover using Would You Buy It? (&ldquo;WYBY&rdquo;) — either to create a price test or to
          answer someone else&apos;s. WYBY is operated by Studio Limeta. By using the site you agree to them.
        </p>

        <h2>What WYBY does</h2>
        <p>
          A creator describes an offer and up to five prices. Each respondent who opens the shared link is shown
          exactly one of those prices, at random, and answers whether they&apos;d buy at that price. The creator
          gets back a report built from real responses — purchase-intent rates, modelled revenue per price, and a
          suggested price where there&apos;s enough data. Nothing in that report is generated or guessed by AI; it
          is arithmetic over the answers people actually gave.
        </p>

        <h2>Creating a test</h2>
        <ul>
          <li>
            Creating a test is free, and the first {config.freeResponseLimit} responses per test are free.
          </li>
          <li>
            Unlocking the full report for a test past that free limit is a one-time payment of{' '}
            {config.unlockCurrency} ${config.unlockPrice.toFixed(2)} — per test, not a subscription. It grants
            access to that one test&apos;s detailed report; it does not unlock any other test.
          </li>
          <li>You&apos;re responsible for the accuracy of what you describe in your offer and for the prices you test.</li>
          <li>
            You won&apos;t use WYBY to test anything illegal, to collect personal data from respondents beyond what
            the product itself asks for, or to try to identify an individual respondent.
          </li>
          <li>We can remove a test that violates these terms or that we reasonably believe is abusive, fraudulent, or spam.</li>
        </ul>

        <h2>Answering a test</h2>
        <p>
          Answering is anonymous and doesn&apos;t require an account. One response per person per test, tracked by
          an anonymous browser cookie — see the <Link href="/cookies">Cookie Policy</Link>. Answers are used only
          to build the aggregated report described above; see the <Link href="/privacy">Privacy Policy</Link> for
          exactly what&apos;s collected and how it&apos;s shared.
        </p>

        <h2>Payments</h2>
        <p>
          Our order process is handled by <strong>Paddle.com</strong>, which acts as the <strong>Merchant of
          Record</strong> for every report unlock. That means Paddle — not WYBY — is the seller for the
          transaction: Paddle takes the payment, calculates and collects any sales tax or VAT that applies where
          you are, issues your invoice, and is the name that appears on your card or bank statement. Paddle&apos;s
          own{' '}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            Buyer Terms and Conditions
          </a>{' '}
          govern that purchase alongside these terms.
        </p>
        <p>
          The {config.unlockCurrency} ${config.unlockPrice.toFixed(2)} unlock price is what WYBY charges for the
          report; any tax Paddle has to add is calculated at checkout and shown in the total before you confirm.
          Because an unlock grants immediate access to a fully generated report, purchases are generally final
          once the report has been unlocked. See our <Link href="/refund-policy">Refund Policy</Link> for
          how payment issues and refund requests are handled. Billing and refunds are processed through Paddle, and
          you can also reach Paddle&apos;s buyer support directly at{' '}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">
            paddle.net
          </a>
          .
        </p>

        <h2>Accounts</h2>
        <p>
          You&apos;re responsible for keeping access to your sign-in method (Google or your email inbox) secure.
          You can delete your account at any time from <Link href="/account">your account page</Link>.
        </p>

        <h2>No warranty</h2>
        <p>
          WYBY reports reflect the responses actually collected — they&apos;re a research signal, not a guarantee of
          real-world sales. We flag when a test doesn&apos;t have enough responses to name a confident
          best-performing price rather than showing you a number we don&apos;t believe. The service is provided
          &ldquo;as is,&rdquo; without warranties of any kind, to the extent the law allows.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms as the product changes. We&apos;ll update the date at the top of this page when
          we do. Continuing to use WYBY after a change means you accept the updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:studiolimeta@gmail.com">studiolimeta@gmail.com</a>.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
