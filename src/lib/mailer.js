import { config } from './config.js';
import { checkRateLimit } from './tests.js';

/**
 * Sends transactional mail through Resend when configured. When it is not
 * (`config.email.enabled === false`), nothing is sent — the caller is expected
 * to check `sendMail`'s return value and show the content on-screen instead.
 * This is the same fallback shape as Google auth and Stripe: build the real
 * path once, degrade to a visible dev fallback rather than a silent no-op.
 */
export async function sendMail({ to, subject, html, text }) {
  if (!config.email.enabled) {
    console.log(`[dev-mail] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, devMode: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.email.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.email.from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`resend_send_failed status=${res.status} body=${body.slice(0, 300)}`);
  }

  return { sent: true, devMode: false };
}

/**
 * Fire-and-forget ops alert when a transactional send fails outright (a real
 * Resend error, not the dev-mode no-op). Throttled to one per
 * `config.rateLimits.opsAlert` window via a fixed identifier, so a sustained
 * outage sends one alert instead of one per failed request. Swallows its own
 * errors — an alert that itself fails to send must never mask or crash the
 * original failure path that called it. Note: if the failure is Resend being
 * fully down or the account quota being exhausted, this alert goes through
 * the same channel and may not arrive either.
 */
export async function alertOpsOfSendFailure(context, err) {
  const to = config.opsAlertEmail;
  if (!to) return;

  const allowed = await checkRateLimit('opsAlert', 'ops-alert');
  if (!allowed) return;

  const subject = `⚠️ WYBI ${context} send failing`;
  const text = `${context} email send failed:\n\n${err.message}\n\nCheck the Resend dashboard (quota/logs) and \`pm2 logs wouldyoubuyit\`.`;

  try {
    await sendMail({ to, subject, html: `<pre style="font-family: monospace; white-space: pre-wrap;">${text}</pre>`, text });
  } catch (alertErr) {
    console.error(`ops_alert_send_failed: ${alertErr.message}`);
  }
}

/** Plain and legible on purpose — a login email is read as often with images off as on. */
export function magicLinkEmail({ url, isNewAccount }) {
  const heading = isNewAccount ? "Confirm your email to start testing" : 'Your login link';
  const text = `${heading}\n\n${url}\n\nThis link works once and expires in 15 minutes. If you didn't ask for this, you can ignore it.`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
      <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #6250f5; margin: 0 0 16px;">Would You Buy It?</p>
      <h1 style="font-size: 22px; margin: 0 0 16px;">${heading}</h1>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">Click the button below. It works once and expires in 15 minutes.</p>
      <a href="${url}" style="display: inline-block; background: #6250f5; color: #fff; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 999px;">
        ${isNewAccount ? 'Confirm and continue →' : 'Log in →'}
      </a>
      <p style="font-size: 13px; color: #5a6478; margin: 24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  return { subject: heading, html, text };
}
