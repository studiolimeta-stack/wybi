import { config } from '../../../../../lib/config.js';
import { createLoginToken, normaliseEmail, safeRedirect } from '../../../../../lib/auth.js';
import { checkRateLimit } from '../../../../../lib/tests.js';
import { clientIp, hashIp } from '../../../../../lib/ids.js';
import { sendMail, magicLinkEmail, alertOpsOfSendFailure } from '../../../../../lib/mailer.js';
import { track } from '../../../../../lib/events.js';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  const ipHash = hashIp(clientIp(request.headers));
  if (!(await checkRateLimit('login', ipHash))) {
    return Response.json({ error: 'Too many attempts. Try again in a while.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'That email does not look right.' }, { status: 422 });
  }

  const next = safeRedirect(body.next);
  const mode = body.mode === 'signup' ? 'signup' : 'login';
  await track('login_started', { props: { provider: 'email', mode } });

  const token = await createLoginToken(email, { redirectTo: next, ipHash });
  const verifyUrl = new URL('/api/auth/email/verify', config.appUrl);
  verifyUrl.searchParams.set('token', token);

  const { subject, html, text } = magicLinkEmail({ url: verifyUrl.toString(), isNewAccount: mode === 'signup' });

  // Deliverability failures must not tell the caller a link went out when it
  // didn't — but they also must never say whether the address exists.
  try {
    const result = await sendMail({ to: email, subject, html, text, type: 'magic_link' });
    return Response.json({
      ok: true,
      devMode: result.devMode,
      devLink: result.devMode ? verifyUrl.toString() : undefined,
    });
  } catch (err) {
    console.error(`magic_link_send_failed: ${err.message}`);
    await alertOpsOfSendFailure('magic-link', err);
    return Response.json({ error: 'Could not send that email right now. Please try again.' }, { status: 502 });
  }
}
