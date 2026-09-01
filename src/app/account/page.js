import { redirect } from 'next/navigation';
import { SiteHeader, SiteFooter } from '../../components/SiteChrome.js';
import { currentUser } from '../../lib/session.js';
import { listIdentities } from '../../lib/auth.js';
import { listTestsByUserId } from '../../lib/tests.js';
import { listPaymentsForUser } from '../../lib/payments.js';
import { ConfirmedPill } from '../../components/StatusPill.js';
import { AccountActions } from './AccountActions.js';
import { BillingSummary } from './BillingSummary.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account', robots: { index: false, follow: false } };

const PROVIDER_LABEL = { google: 'Google', email: 'Email link' };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');

  const [identities, tests, payments] = await Promise.all([
    listIdentities(user.id),
    listTestsByUserId(user.id),
    listPaymentsForUser(user.id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="wrap pt-6 pb-16">
        <div className="mx-auto max-w-lg">
          <h1 className="text-3xl font-extrabold tracking-tight">Account</h1>

          <div className="card mt-6 p-6">
            <p className="label">Email</p>
            <p className="flex items-center gap-2 text-lg font-bold">
              {user.email}
              {user.emailVerifiedAt && <ConfirmedPill>Verified</ConfirmedPill>}
            </p>

            <p className="label mt-5">Sign-in methods</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {identities.map((identity) => (
                <li key={identity.provider} className="pill bg-white">
                  {PROVIDER_LABEL[identity.provider] || identity.provider}
                </li>
              ))}
            </ul>
          </div>

          <BillingSummary tests={tests} payments={payments} />

          <AccountActions />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
