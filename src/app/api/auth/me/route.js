import { currentUser } from '../../../../lib/session.js';
import { isAdminEmail } from '../../../../lib/admin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Polled once on mount by SiteHeaderStatic — the homepage is `force-static`
 * so its server-rendered header can never know who's actually logged in
 * (see that component's comment). This is the one place that asks for real.
 * Deliberately minimal: name/email and the isAdmin flag are the only fields
 * the header needs, nothing else about the account leaks through this route.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null, isAdmin: false });

  return Response.json({
    user: { name: user.name ?? null, email: user.email },
    isAdmin: isAdminEmail(user.email),
  });
}
