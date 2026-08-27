import { config } from './config.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token from the respondent vote form.
 *
 * Same dev-fallback shape as google/email/stripe (decision 11): when
 * TURNSTILE_SECRET_KEY isn't configured this resolves to true immediately,
 * so local/dev respond-flow testing never blocks on a credential nobody has
 * set up — the widget only starts firing once real keys land in .env.
 */
export async function verifyTurnstileToken(token, remoteIp) {
  if (!config.turnstile.enabled) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret: config.turnstile.secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    // Fail open: if Cloudflare's own verify API is unreachable, letting a
    // vote through unverified is a smaller cost than dropping every real
    // respondent's answer for the duration of a third-party outage.
    console.error(`turnstile_verify_failed: ${err.message}`);
    return true;
  }
}
