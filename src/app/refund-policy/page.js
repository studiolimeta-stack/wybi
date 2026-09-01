import Link from 'next/link';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { LegalPage } from '../../components/LegalPage.js';

export const metadata = { title: 'Refund Policy — Would You Buy It?' };

const UPDATED = 'September 1, 2026';

export default function RefundPolicyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage title="Refund Policy" updated={UPDATED}>
        <p>
          This policy explains how refunds for Would You Buy It? (&ldquo;WYBY&rdquo;) report unlocks work. It sits
          alongside our <Link href="/terms">Terms of Service</Link> and does not limit any rights you have under
          applicable law.
        </p>

        <h2>What you buy</h2>
        <p>
          A report unlock is a one-time purchase that gives access to the detailed results for one specific price
          test. It is not a subscription and does not guarantee a particular commercial outcome, sales result, or
          recommended price.
        </p>

        <h2>Our policy</h2>
        <p>
          The report is made available immediately after payment, so purchases are generally final once the report
          has been unlocked. A disappointing result or a result that does not meet an expectation is not, by itself,
          a reason for a refund. This does not affect rights that cannot be excluded under applicable consumer law.
        </p>
        <p>
          If you were charged in error, charged more than once, or cannot access an unlocked report, contact us so
          we can investigate and help resolve the issue.
        </p>

        <h2>How refunds are handled</h2>
        <p>
          Paddle.com is the Merchant of Record for WYBY purchases. Paddle processes payment, invoices, tax, and any
          approved refund. If a refund is approved, Paddle returns it to the original payment method where possible;
          we do not send refunds directly.
        </p>
        <p>
          You can request a refund through the link in your Paddle receipt or directly through{' '}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">Paddle buyer support</a>. Paddle&apos;s{' '}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
            Refund Policy
          </a>{' '}
          and buyer terms apply alongside this policy, including any statutory withdrawal or refund rights.
        </p>

        <h2>Contact us</h2>
        <p>
          For help with access, duplicate charges, or a product issue, email{' '}
          <a href="mailto:studiolimeta@gmail.com">studiolimeta@gmail.com</a>. Include the email address used at
          checkout and your Paddle receipt or transaction reference if available. Do not send payment-card details.
        </p>
      </LegalPage>
      <SiteFooter />
    </>
  );
}
